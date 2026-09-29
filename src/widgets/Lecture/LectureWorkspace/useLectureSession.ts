'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { appendAiSection, coveredSeqs, refreshableSections, replaceSection, textBefore } from '../editor/docOps'
import { deleteChunk, pendingChunks } from '../recorder/chunkQueue'
import { lectureRecorder } from '../recorder/lectureRecorder'
import { useRecorderState } from '../recorder/useRecorderState'
import type { ChunkDto, LectureDto, LectureResponse, TariffDto, UploadIssue } from './types'

/** Structure every ~60 s of new speech — fewer DeepSeek calls, more context per call. The first section comes sooner, so the page isn't empty for a minute. */
const STRUCTURE_EVERY_MS = 55_000
const FIRST_STRUCTURE_MS = 25_000
/** One DeepSeek call gets at most this much audio — enough context, still a fast answer. */
const MAX_BATCH_MS = 5 * 60_000
const MAX_BATCH_CHUNKS = 40
const AUTOSAVE_MS = 1500
const POLL_FINAL_MS = 8000
const localKey = (id: string) => `gw-lecture-doc:${id}`

/** A pending "fix by photo"/"ask AI" mark can't survive a reload — its request is gone. */
function stripPending(doc: JSONContent | null): JSONContent | null {
  if (!doc) return doc
  const walk = (n: JSONContent): JSONContent => ({
    ...n,
    ...(n.marks ? { marks: n.marks.filter(m => m.type !== 'pendingFix') } : {}),
    ...(n.content ? { content: n.content.map(walk) } : {}),
  })
  return walk(doc)
}

interface SeqRange { from: number; to: number; ms: number }

export function useLectureSession(lectureId: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const [lecture, setLecture] = useState<LectureDto | null>(null)
  const [chunks, setChunks] = useState<ChunkDto[]>([])
  const [tariff, setTariff] = useState<TariffDto | null>(null)
  const [access, setAccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sttConfigured, setSttConfigured] = useState(true)
  const [initialDoc, setInitialDoc] = useState<JSONContent | null | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const [queued, setQueued] = useState(0)
  const [issue, setIssue] = useState<UploadIssue>(null)
  const [structuring, setStructuring] = useState(false)
  const [autoStructure, setAutoStructure] = useState(true)
  const [refining, setRefining] = useState(false)
  const [stopping, setStopping] = useState(false)
  const recorder = useRecorderState()

  const editorRef = useRef<Editor | null>(null)
  const lastStructured = useRef(-1)
  const received = useRef(new Map<number, ChunkDto>())
  const pumping = useRef(false)
  const structureBusy = useRef(false)
  /** Ranges the AI found no lecture content in (this session) — not offered again. */
  const skipped = useRef(new Set<number>())
  /** Auto mode got an empty answer for the tail — wait for more speech before retrying it. */
  const emptyTail = useRef<{ from: number; ms: number } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDoc = useRef<JSONContent | null>(null)
  const refinedFor = useRef(false)
  const autoStructureRef = useRef(autoStructure)
  useEffect(() => { autoStructureRef.current = autoStructure }, [autoStructure])

  // ── Load ────────────────────────────────────────────────
  const load = useCallback(async () => {
    const res = await fetch(`/api/lecture/${lectureId}`)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as LectureResponse
    setLecture(data.lecture)
    setChunks(data.chunks)
    setTariff(data.tariff)
    setAccess(data.access)
    setIsAdmin(data.isAdmin)
    setSttConfigured(data.sttConfigured)
    for (const c of data.chunks) received.current.set(c.seq, c)
    return data
  }, [lectureId])

  useEffect(() => {
    let cancelled = false
    load().then(data => {
      if (cancelled) return
      lastStructured.current = data.lecture.processedSeq
      // Local backup wins when it's newer than the server copy (closed tab mid-save).
      let doc = data.lecture.docJson as JSONContent | null
      try {
        const raw = localStorage.getItem(localKey(lectureId))
        if (raw) {
          const backup = JSON.parse(raw) as { at: number; doc: JSONContent }
          if (backup.at > new Date(data.lecture.updatedAt).getTime() + 1000) doc = backup.doc
        }
      } catch { /* storage unavailable */ }
      setInitialDoc(stripPending(doc))
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [load, lectureId])

  // ── Autosave ────────────────────────────────────────────
  const flushSave = useCallback(async (keepalive = false) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const doc = latestDoc.current
    if (!doc) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/lecture/${lectureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docJson: doc }),
        keepalive: keepalive && JSON.stringify(doc).length < 60_000,
      })
      if (!res.ok) throw new Error(String(res.status))
      latestDoc.current = latestDoc.current === doc ? null : latestDoc.current
      setSaveState(latestDoc.current ? 'dirty' : 'saved')
    } catch {
      setSaveState('error')
    }
  }, [lectureId])

  const onDocChange = useCallback((doc: JSONContent) => {
    latestDoc.current = doc
    setSaveState('dirty')
    try { localStorage.setItem(localKey(lectureId), JSON.stringify({ at: Date.now(), doc })) } catch { /* full / private */ }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { flushSave() }, AUTOSAVE_MS)
  }, [flushSave, lectureId])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && latestDoc.current) flushSave(true) }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide) }
  }, [flushSave])

  // ── Structuring (DeepSeek) ──────────────────────────────
  /**
   * Everything recorded but not yet in the notes, in DeepSeek-sized batches: the tail after
   * the last structured chunk plus gaps (ranges an earlier pass returned nothing for,
   * sections the student deleted). Silent chunks join their neighbours but add no time.
   */
  const unstructured = useCallback((): SeqRange[] => {
    const editor = editorRef.current
    const covered = editor ? coveredSeqs(editor) : new Set<number>()
    const out: SeqRange[] = []
    let cur: SeqRange | null = null
    let prev = -2
    for (const seq of [...received.current.keys()].sort((a, b) => a - b)) {
      const c = received.current.get(seq)!
      const free = !covered.has(seq) && !skipped.current.has(seq)
      if (cur && (!free || seq !== prev + 1)) { out.push(cur); cur = null }
      prev = seq
      if (!free || !c.text.trim()) continue
      if (cur && (cur.ms + c.durationMs > MAX_BATCH_MS || seq - cur.from >= MAX_BATCH_CHUNKS)) { out.push(cur); cur = null }
      if (!cur) cur = { from: seq, to: seq, ms: 0 }
      cur.to = seq
      cur.ms += c.durationMs
    }
    if (cur) out.push(cur)
    return out
  }, [])

  /** For the "Законспектировать сейчас" badge: how much recorded speech isn't in the notes. */
  const pendingRange = useCallback((): SeqRange | null => {
    const ranges = unstructured()
    if (!ranges.length) return null
    return { from: ranges[0].from, to: ranges[ranges.length - 1].to, ms: ranges.reduce((a, r) => a + r.ms, 0) }
  }, [unstructured])

  /** One range → DeepSeek (clean, then notes) → a section in its place. 'empty' = nothing to add. */
  const structureRange = useCallback(async (editor: Editor, range: SeqRange): Promise<'added' | 'empty'> => {
    // Notes go before the first section of later audio, so "don't repeat" context is what precedes that spot.
    let at = editor.state.doc.content.size
    editor.state.doc.forEach((node, pos) => { if (node.type.name === 'aiSection' && node.attrs.fromSeq > range.to && pos < at) at = pos })
    const res = await fetch(`/api/lecture/${lectureId}/structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromSeq: range.from, toSeq: range.to, previousNotes: textBefore(editor, at, 2500) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'AI_FAILED')
    if (data.context) setLecture(l => l && { ...l, context: data.context })
    const blocks = data.blocks ?? []
    if (!blocks.length) return 'empty'
    appendAiSection(editor, blocks, { fromSeq: range.from, toSeq: range.to, startMs: received.current.get(range.from)?.startMs ?? 0, final: !!data.isFinal })
    lastStructured.current = Math.max(lastStructured.current, range.to)
    return 'added'
  }, [lectureId])

  const skip = (range: SeqRange) => {
    for (let s = range.from; s <= range.to; s++) skipped.current.add(s)
    lastStructured.current = Math.max(lastStructured.current, range.to)
  }

  /**
   * Auto: the tail once enough new speech piled up. Forced ("Законспектировать сейчас", stop):
   * every unstructured range, gaps included — so a lecture eaten by empty passes comes back.
   */
  const structure = useCallback(async (force = false) => {
    const editor = editorRef.current
    if (!editor || structureBusy.current) return
    let ranges = unstructured()
    if (!force) {
      const tail = ranges.find(r => r.from > lastStructured.current)
      if (!tail) return
      const waited = emptyTail.current?.from === tail.from ? emptyTail.current.ms : 0
      if (tail.ms - waited < (lastStructured.current < 0 ? FIRST_STRUCTURE_MS : STRUCTURE_EVERY_MS)) return
      ranges = [tail]
    }
    if (!ranges.length) return
    structureBusy.current = true
    setStructuring(true)
    let added = 0
    let empty = 0
    try {
      for (const range of ranges) {
        const result = await structureRange(editor, range)
        if (result === 'added') { added++; if (emptyTail.current?.from === range.from) emptyTail.current = null; continue }
        empty++
        // Forced, or a full batch still with nothing in it — give up on it; else wait for more speech.
        if (force || range.ms >= MAX_BATCH_MS - 30_000) skip(range)
        else emptyTail.current = { from: range.from, ms: range.ms }
      }
      if (force && !added && empty) toast.info(t('structureEmpty'))
    } catch {
      toast.error(t('structureFailed'))
    } finally {
      structureBusy.current = false
      setStructuring(false)
    }
  }, [structureRange, t, unstructured])

  // ── Upload pump (IndexedDB → server) ────────────────────
  const pump = useCallback(async () => {
    if (pumping.current) return
    pumping.current = true
    try {
      let backoff = 2000
      for (;;) {
        const items = await pendingChunks(lectureId)
        setQueued(items.length)
        if (!items.length) { setIssue(null); break }
        const c = items[0]
        const form = new FormData()
        form.append('audio', c.blob, `chunk.${c.mime.includes('mp4') ? 'm4a' : 'webm'}`)
        form.append('seq', String(c.seq))
        form.append('startMs', String(c.startMs))
        form.append('durationMs', String(Math.min(c.durationMs, 60_000)))
        let res: Response
        try {
          res = await fetch(`/api/lecture/${lectureId}/chunks`, { method: 'POST', body: form })
        } catch {
          setIssue('offline')
          await new Promise(r => setTimeout(r, backoff))
          backoff = Math.min(backoff * 2, 30_000)
          continue
        }
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          backoff = 2000
          setIssue(null)
          await deleteChunk(lectureId, c.seq)
          const dto: ChunkDto = { seq: c.seq, startMs: c.startMs, durationMs: c.durationMs, text: data.text ?? '', isFinal: false, hasAudio: true }
          received.current.set(c.seq, dto)
          setChunks(prev => [...prev.filter(p => p.seq !== c.seq), dto].sort((a, b) => a.seq - b.seq))
          setLecture(l => l && { ...l, recordedMs: data.recordedMs ?? l.recordedMs, costKopecks: data.costKopecks ?? l.costKopecks })
          if (data.audioQuotaHit) toast.warning(t('audioQuotaHit'))
          if (autoStructureRef.current) structure()
          continue
        }
        if (res.status === 429 && data.error === 'DAILY_LIMIT') {
          setIssue('limit')
          toast.error(t('dailyLimit', { min: data.maxMinutesPerDay ?? 0 }))
          await lectureRecorder.stop()
          break
        }
        if (res.status === 429 || res.status === 503) {
          setIssue(res.status === 429 ? 'busy' : 'stt')
          await new Promise(r => setTimeout(r, backoff))
          backoff = Math.min(backoff * 2, 30_000)
          continue
        }
        if (res.status === 409) { await deleteChunk(lectureId, c.seq); continue } // lecture already finished
        if (res.status === 403) { toast.error(t('vipOnly')); break }
        // Anything else (bad chunk) — drop it rather than block the queue forever.
        await deleteChunk(lectureId, c.seq)
      }
    } finally {
      pumping.current = false
    }
  }, [lectureId, structure, t])

  // New chunk recorded → pump. Also resend leftovers from a crash/closed tab.
  useEffect(() => {
    if (!lecture) return
    pump()
    const off = lectureRecorder.onChunk(id => { if (id === lectureId) pump() })
    const online = () => pump()
    window.addEventListener('online', online)
    return () => { off(); window.removeEventListener('online', online) }
  }, [lecture?.id, lectureId, pump]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recording controls ─────────────────────────────────
  const isRecordingHere = recorder.lectureId === lectureId && (recorder.status === 'recording' || recorder.status === 'starting')

  const startRecording = useCallback(async () => {
    if (!lecture) return
    const nextSeq = Math.max(-1, ...chunks.map(c => c.seq), ...(await pendingChunks(lectureId)).map(c => c.seq)) + 1
    const ok = await lectureRecorder.start(lectureId, nextSeq, lecture.recordedMs)
    if (!ok) {
      const err = lectureRecorder.getState().error
      toast.error(err === 'MIC_DENIED' ? t('micDenied') : err === 'UNSUPPORTED' ? t('micUnsupported') : t('micFailed'))
    }
  }, [chunks, lecture, lectureId, t])

  /** Stop → drain the queue → structure the rest → final pass on the big model. */
  const stopRecording = useCallback(async () => {
    setStopping(true)
    try {
      await lectureRecorder.stop()
      await pump()
      if ((await pendingChunks(lectureId)).length) { toast.warning(t('stillQueued')); return }
      // An auto pass may still be running — let it land, then take the rest.
      while (structureBusy.current) await new Promise(r => setTimeout(r, 300))
      await structure(true)
      await flushSave()
      const res = await fetch(`/api/lecture/${lectureId}/finish`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setLecture(l => l && { ...l, status: data.status })
    } finally {
      setStopping(false)
    }
  }, [flushSave, lectureId, pump, structure, t])

  const finalize = useCallback(async () => {
    const res = await fetch(`/api/lecture/${lectureId}/finish`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) { refinedFor.current = false; setLecture(l => l && { ...l, status: data.status }) }
  }, [lectureId])

  // ── Final pass → refresh untouched AI sections with the big-model text ──
  const refineSections = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return
    const targets = refreshableSections(editor)
    if (!targets.length) return
    setRefining(true)
    let done = 0
    for (const s of targets) {
      try {
        const res = await fetch(`/api/lecture/${lectureId}/structure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromSeq: s.fromSeq, toSeq: s.toSeq, previousNotes: textBefore(editor, s.pos, 2500) }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.isFinal && replaceSection(editor, s.fromSeq, s.toSeq, data.blocks ?? [])) done++
      } catch { /* keep the draft section */ }
    }
    setRefining(false)
    if (done) toast.success(t('refined', { n: done }))
  }, [lectureId, t])

  useEffect(() => {
    if (lecture?.status !== 'FINALIZING') return
    const id = setInterval(async () => {
      try {
        const data = await load()
        if (data.lecture.status === 'READY') clearInterval(id)
      } catch { /* next tick */ }
    }, POLL_FINAL_MS)
    return () => clearInterval(id)
  }, [lecture?.status, load])

  useEffect(() => {
    if (lecture?.status === 'READY' && editorRef.current && !refinedFor.current) {
      refinedFor.current = true
      refineSections()
    }
  }, [lecture?.status, refineSections, initialDoc])

  const setKeepAudio = useCallback(async (keepAudio: boolean) => {
    setLecture(l => l && { ...l, keepAudio })
    await fetch(`/api/lecture/${lectureId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keepAudio }) }).catch(() => {})
  }, [lectureId])

  /** The student corrects subject/topic/subtopics — the server pins what was sent. */
  const setContext = useCallback(async (patch: { subject?: string; topic?: string; subtopics?: string[] }) => {
    const res = await fetch(`/api/lecture/${lectureId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: patch }) }).catch(() => null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (data?.lecture?.context) setLecture(l => l && { ...l, context: data.lecture.context })
    else toast.error(t('saveError'))
  }, [lectureId, t])

  const setTitle = useCallback(async (title: string) => {
    setLecture(l => l && { ...l, title })
    await fetch(`/api/lecture/${lectureId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }).catch(() => {})
  }, [lectureId])

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor
    if (lecture?.status === 'READY' && !refinedFor.current) { refinedFor.current = true; refineSections() }
  }, [lecture?.status, refineSections])

  return {
    lecture, chunks, tariff, access, isAdmin, sttConfigured, initialDoc, loadError,
    saveState, flushSave, onDocChange, onEditorReady, editorRef,
    queued, issue, structuring, autoStructure, setAutoStructure, structureNow: () => structure(true), pendingRange,
    recorder, isRecordingHere, startRecording, stopRecording, stopping, finalize, refining,
    setKeepAudio, setTitle, setContext, reload: load,
  }
}
