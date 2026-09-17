'use client'

import { ChatMicIcon } from '@/widgets/Chat/icons'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import styles from './VoiceMessagePlayer.module.scss'

const BAR_COUNT = 40

/**
 * Same technique as `InfoAudioEditor`'s `AudioPlayer` (posts feature) — Web
 * Audio API amplitude buckets, no charting library — but computed lazily
 * client-side on first render instead of stored at upload time: chat's
 * `ChatMessage` has no waveform column, and adding one would need a
 * migration for a purely cosmetic feature. Voice notes are short, so
 * decoding on view is cheap and happens once per message (cached in this
 * component's own state, not re-run on poll re-renders since the message
 * id/url don't change).
 */
async function extractWaveform(url: string): Promise<number[]> {
  const res = await fetch(url)
  const arrayBuffer = await res.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const audioCtx = new AudioCtx()
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const raw = audioBuffer.getChannelData(0)
    const blockSize = Math.max(1, Math.floor(raw.length / BAR_COUNT))
    const peaks: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      const start = i * blockSize
      for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j] ?? 0)
      peaks.push(sum / blockSize)
    }
    const max = Math.max(...peaks, 0.001)
    return peaks.map(p => p / max)
  } finally {
    audioCtx.close()
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface VoiceMessagePlayerProps {
  url: string
  /** True when rendered inside the sender's own (solid-purple) bubble —
   * swaps the waveform/button palette for a light-on-purple variant instead
   * of the default light-on-white one. */
  isMine?: boolean
}

/** Voice-message player for the chat bubble — waveform bars, play/pause,
 * timer. Sibling to (not shared with) the posts feature's `AudioPlayer`:
 * different layer of the app, different sizing (fits a chat bubble, not a
 * full-width post block), different accent color (chat's purple, not
 * posts' rose). */
export function VoiceMessagePlayer({ url, isMine = false }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number>(0)
  const [waveform, setWaveform] = useState<number[] | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    let cancelled = false
    extractWaveform(url)
      .then(w => { if (!cancelled) setWaveform(w) })
      .catch(() => { if (!cancelled) setWaveform(Array(BAR_COUNT).fill(0.35)) })
    return () => { cancelled = true }
  }, [url])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Plain (hoisted) function declarations, not `useCallback` — `runTick`
  // schedules itself recursively via `requestAnimationFrame`, which needs to
  // reference its own name before a `const tick = useCallback(...)` binding
  // would exist yet. Neither is memoized: this component has no expensive
  // child re-render to guard against, so recreating them each render costs
  // nothing worth naming.
  function runTick() {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime)
    setProgress(el.duration ? el.currentTime / el.duration : 0)
    if (!el.paused) rafRef.current = requestAnimationFrame(runTick)
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
      setPlaying(true)
      rafRef.current = requestAnimationFrame(runTick)
    } else {
      el.pause()
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
    }
  }

  function handleEnded() {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    cancelAnimationFrame(rafRef.current)
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !el.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * el.duration
    setProgress(ratio)
    setCurrentTime(el.currentTime)
    if (el.paused) {
      el.play().catch(() => {})
      setPlaying(true)
      rafRef.current = requestAnimationFrame(runTick)
    }
  }

  const bars = waveform ?? Array(BAR_COUNT).fill(0.2)
  const passedBars = Math.round(progress * bars.length)

  return (
    <div className={`${styles.player} ${isMine ? styles.playerMine : ''}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          const el = audioRef.current
          if (!el) return
          // Chrome reports `duration: Infinity` for many MediaRecorder-produced
          // webm blobs until something seeks — force it once, silently, so
          // the timer shows a real length instead of "0:00" forever.
          if (!Number.isFinite(el.duration)) {
            const restore = () => {
              el.currentTime = 0
              setDuration(el.duration)
              el.removeEventListener('timeupdate', restore)
            }
            el.addEventListener('timeupdate', restore)
            el.currentTime = 1e10
          } else {
            setDuration(el.duration)
          }
        }}
        onEnded={handleEnded}
      />

      <button type="button" className={styles.playBtn} onClick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>

      <div className={styles.body}>
        <div className={`${styles.waveform} ${waveform ? '' : styles.waveformLoading}`} onClick={handleWaveformClick}>
          {bars.map((amp, i) => (
            <div
              key={i}
              className={`${styles.bar} ${i < passedBars ? styles.barPassed : ''}`}
              style={{ '--amp': amp } as React.CSSProperties}
            />
          ))}
        </div>
        <div className={styles.timer}>
          <ChatMicIcon size={11} strokeWidth={2} />
          <span>{formatTime(playing || currentTime > 0 ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  )
}
