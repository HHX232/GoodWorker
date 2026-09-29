'use client'

import { putChunk } from './chunkQueue'

// One recorder per tab, outside React: it's started from the click on
// /lecture (a user gesture — Safari won't run an AudioContext without one)
// and keeps recording through the client-side navigation to /lecture/[id].
//
// The stream is cut into standalone ~15–28 s files, preferably at a pause
// (so a word isn't split between two chunks): each segment is its own
// MediaRecorder, so every chunk has its own container header and decodes on
// its own on the STT server. Every chunk goes to IndexedDB first.

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'error'
export type RecorderError = 'MIC_DENIED' | 'UNSUPPORTED' | 'MIC_LOST' | 'UNKNOWN'

export interface RecorderState {
  status: RecorderStatus
  lectureId: string | null
  /** Lecture time, including what was recorded before this session. */
  elapsedMs: number
  /** Input level 0..1 for the meter. */
  level: number
  error: RecorderError | null
  /** The tab went to the background while recording — iOS pauses the mic there. */
  wasHidden: boolean
  wakeLock: boolean
}

const MIN_SEGMENT_MS = 15_000
const MAX_SEGMENT_MS = 28_000
const SILENCE_HOLD_MS = 400
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']

type Listener = (s: RecorderState) => void
type ChunkListener = (lectureId: string, seq: number) => void

interface WakeLockSentinelLike { release: () => Promise<void> }

class LectureRecorder {
  private state: RecorderState = { status: 'idle', lectureId: null, elapsedMs: 0, level: 0, error: null, wasHidden: false, wakeLock: false }
  private listeners = new Set<Listener>()
  private chunkListeners = new Set<ChunkListener>()
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private rec: MediaRecorder | null = null
  private mime = ''
  private seq = 0
  private offsetMs = 0
  private t0 = 0
  private segStart = 0
  private quietSince = 0
  private noiseFloor = 0.01
  private timer: ReturnType<typeof setInterval> | null = null
  private wakeLock: WakeLockSentinelLike | null = null
  private pendingStops = 0
  private stopWaiters: (() => void)[] = []

  getState(): RecorderState {
    return this.state
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** Fires after a chunk is safely in the local queue. */
  onChunk(fn: ChunkListener): () => void {
    this.chunkListeners.add(fn)
    return () => { this.chunkListeners.delete(fn) }
  }

  private set(patch: Partial<RecorderState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  }

  /** `startSeq`/`offsetMs` continue an existing lecture (resume after stop or reload). */
  async start(lectureId: string, startSeq: number, offsetMs: number): Promise<boolean> {
    if (this.state.status === 'recording' || this.state.status === 'starting') return this.state.lectureId === lectureId
    if (!this.isSupported()) {
      this.set({ status: 'error', error: 'UNSUPPORTED', lectureId })
      return false
    }
    this.set({ status: 'starting', lectureId, error: null, wasHidden: false, elapsedMs: offsetMs })
    try {
      // Noise suppression + AGC help a phone far from the lecturer; echo
      // cancellation only hurts here (nothing is played back).
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      })
    } catch (e) {
      const name = (e as DOMException)?.name
      this.set({ status: 'error', error: name === 'NotAllowedError' || name === 'SecurityError' ? 'MIC_DENIED' : 'UNKNOWN' })
      return false
    }
    this.mime = MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      await this.ctx.resume().catch(() => {})
      const source = this.ctx.createMediaStreamSource(this.stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      source.connect(this.analyser)
    } catch {
      this.analyser = null // no level meter / pause detection — segments are cut on time only
    }
    this.stream.getAudioTracks()[0]?.addEventListener('ended', this.onTrackEnded)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.seq = startSeq
    this.offsetMs = offsetMs
    this.t0 = performance.now()
    this.noiseFloor = 0.01
    this.beginSegment()
    this.timer = setInterval(this.tick, 100)
    await this.requestWakeLock()
    this.set({ status: 'recording' })
    return true
  }

  /** Stops and resolves once the last chunk is in the local queue. */
  async stop(): Promise<void> {
    if (this.state.status !== 'recording') return
    this.set({ status: 'stopping' })
    const done = new Promise<void>(resolve => this.stopWaiters.push(resolve))
    this.endSegment()
    if (this.pendingStops === 0) this.flushStopWaiters()
    await done
    this.teardown()
    this.set({ status: 'idle', level: 0 })
  }

  private beginSegment() {
    if (!this.stream) return
    const rec = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 })
    const parts: Blob[] = []
    const segStart = performance.now()
    const seq = this.seq++
    const lectureId = this.state.lectureId!
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
    rec.onstop = () => {
      const durationMs = Math.round(performance.now() - segStart)
      const mime = (rec.mimeType || this.mime || 'audio/webm').split(';')[0]
      const blob = new Blob(parts, { type: mime })
      const startMs = Math.round(this.offsetMs + (segStart - this.t0))
      const finish = () => {
        this.pendingStops--
        if (this.pendingStops === 0 && this.state.status === 'stopping') this.flushStopWaiters()
      }
      if (blob.size < 1000 || durationMs < 700) { finish(); return } // a click of the button, nothing said
      putChunk({ lectureId, seq, startMs, durationMs, mime, blob })
        .then(() => { for (const l of this.chunkListeners) l(lectureId, seq) })
        .finally(finish)
    }
    rec.start()
    this.rec = rec
    this.segStart = segStart
    this.quietSince = 0
  }

  private endSegment() {
    const rec = this.rec
    this.rec = null
    if (rec && rec.state !== 'inactive') {
      this.pendingStops++
      rec.stop()
    }
  }

  private tick = () => {
    const now = performance.now()
    let rms = 0
    if (this.analyser) {
      const buf = new Float32Array(this.analyser.fftSize)
      this.analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      rms = Math.sqrt(sum / buf.length)
      // Slow-rising, fast-falling floor: tracks the room's background level.
      this.noiseFloor = rms < this.noiseFloor ? rms : this.noiseFloor * 0.999 + rms * 0.001
    }
    const segMs = now - this.segStart
    const quiet = this.analyser ? rms < Math.max(this.noiseFloor * 1.8, 0.004) : false
    if (quiet) { if (!this.quietSince) this.quietSince = now } else this.quietSince = 0
    const pause = this.quietSince && now - this.quietSince >= SILENCE_HOLD_MS
    if ((segMs >= MIN_SEGMENT_MS && pause) || segMs >= MAX_SEGMENT_MS) {
      this.endSegment()
      this.beginSegment()
    }
    this.set({ elapsedMs: Math.round(this.offsetMs + (now - this.t0)), level: Math.min(1, rms * 12) })
  }

  private onTrackEnded = () => {
    // Mic unplugged, or the OS took it (a phone call): keep what we have.
    if (this.state.status !== 'recording') return
    this.stop().then(() => this.set({ status: 'error', error: 'MIC_LOST' }))
  }

  private onVisibility = () => {
    if (document.hidden) {
      if (this.state.status === 'recording') this.set({ wasHidden: true })
    } else if (this.state.status === 'recording') {
      this.requestWakeLock()
    }
  }

  private async requestWakeLock() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
      if (!wl) return
      this.wakeLock = await wl.request('screen')
      this.set({ wakeLock: true })
    } catch {
      this.set({ wakeLock: false })
    }
  }

  dismissHiddenWarning() {
    this.set({ wasHidden: false })
  }

  private flushStopWaiters() {
    const waiters = this.stopWaiters
    this.stopWaiters = []
    for (const w of waiters) w()
  }

  private teardown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.stream?.getAudioTracks()[0]?.removeEventListener('ended', this.onTrackEnded)
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
    this.ctx?.close().catch(() => {})
    this.ctx = null
    this.analyser = null
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.wakeLock?.release().catch(() => {})
    this.wakeLock = null
    this.set({ wakeLock: false })
  }
}

export const lectureRecorder = new LectureRecorder()
