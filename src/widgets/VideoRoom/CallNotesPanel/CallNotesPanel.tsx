'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { AudioLinesIcon, HardDriveIcon, NotebookPenIcon, NotebookTextIcon, XIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CallNotesStatus } from '../hooks/useCallNotes'
import styles from './CallNotesPanel.module.scss'

// The lecture editor (tiptap, mathlive, boards) stays out of the call bundle until the panel opens.
const LectureEditor = dynamic(() => import('@/widgets/Lecture/editor/LectureEditor').then(m => m.LectureEditor), {
  ssr: false,
  loading: () => <div className={styles.docLoading} aria-busy="true"><span /><span /><span /></div>,
})

const POLL_MS = 30_000

interface Props {
  open: boolean
  onClose: () => void
  roomName: string
  /** The owner's own status, or the last one the owner broadcast; null — nothing heard yet. */
  status: CallNotesStatus | null
  /** The live transcript (the call page renders it — it owns the lines and SR state). */
  transcriptTab: ReactNode
  /** Bumped by the owner after each successful tick — the doc is re-read when it changes. */
  docVersion?: number
}

interface NotesDoc { id: string | null; doc: JSONContent | null; docVersion: number; sections: number; savedAt: string | null }

const hhmm = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
const SECTION_WORD = { one: 'раздел', few: 'раздела', many: 'разделов', other: 'раздела' } as Record<string, string>
const sectionsLabel = (n: number) => `${n} ${SECTION_WORD[new Intl.PluralRules('ru').select(n)] ?? 'разделов'}`

function statusLine(s: CallNotesStatus | null): { text: string; tone: 'wait' | 'busy' | 'ok' | 'warn' | 'off' } {
  if (!s) return { text: 'Ожидаю конспект от ведущего', tone: 'wait' }
  switch (s.phase) {
    case 'speech': return { text: 'Конспектирую речь…', tone: 'busy' }
    case 'board': return { text: 'Читаю доску…', tone: 'busy' }
    case 'ok': return { text: `${s.tidied ? 'Черновик почищен' : 'Обновлено'} в ${hhmm(s.updatedAt)}`, tone: 'ok' }
    case 'error': return { text: 'Не удалось обновить, повторю через минуту', tone: 'warn' }
    case 'no_ai': return { text: 'ИИ недоступен — конспект не ведётся', tone: 'off' }
    default: return { text: 'Слушаю урок', tone: 'wait' }
  }
}

const hasContent = (doc: JSONContent | null) => !!doc?.content?.length

/**
 * Slide-out panel of the call: the live lesson notes (the lecture editor, read-only)
 * and the transcript. No toasts — everything about the notes is the status line.
 */
export function CallNotesPanel({ open, onClose, roomName, status, transcriptTab, docVersion }: Props) {
  const [tab, setTab] = useState<'doc' | 'transcript'>('doc')
  // Nothing is fetched (and the editor chunk not loaded) before the first open.
  // doc — the editor's initial content (later docs go in via setContent); id — the note being shown.
  const [shown, setShown] = useState<{ id: string; doc: JSONContent } | null>(null)
  const [fetched, setFetched] = useState<Pick<NotesDoc, 'sections' | 'savedAt'> | null>(null)
  const [denied, setDenied] = useState(false)
  const shownRef = useRef<{ id: string; version: number } | null>(null)
  const latestDoc = useRef<JSONContent | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)

  // New doc in place (no remount → no flicker); follow it down only if the reader was at the bottom.
  const apply = useCallback((doc: JSONContent) => {
    const ed = editorRef.current
    if (!ed) return
    const el = scroller.current
    const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 48
    ed.commands.setContent(doc, { emitUpdate: false })
    if (atBottom && el) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
    }
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/call/notes?roomName=${encodeURIComponent(roomName)}`).catch(() => null)
    if (res?.status === 403) { setDenied(true); return }
    const data = res?.ok ? (await res.json().catch(() => null)) as NotesDoc | null : null
    if (!data) return
    setFetched({ sections: data.sections, savedAt: data.savedAt })
    const { id, doc } = data
    if (!id || !doc || !hasContent(doc)) return
    // Only newer than what's shown: another note (after the finale — my own copy), or a higher version.
    // Requests overlap (open + signal + poll), so an older answer can land last.
    const cur = shownRef.current
    if (cur && cur.id === id && data.docVersion <= cur.version) return
    shownRef.current = { id, version: data.docVersion }
    latestDoc.current = doc
    if (editorRef.current) apply(doc)
    if (cur?.id !== id) setShown(prev => ({ id, doc: prev?.doc ?? doc }))
  }, [roomName, apply])

  // Read on open and on the owner's signal; without signals — every 30 s while open.
  useEffect(() => {
    if (!open || !roomName) return
    void load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [open, roomName, docVersion, load])

  useEffect(() => { if (open) panel.current?.focus({ preventScroll: true }) }, [open])

  const onReady = useCallback((ed: Editor) => {
    editorRef.current = ed
    // A newer doc may have come while the editor chunk was loading.
    if (latestDoc.current && latestDoc.current !== ed.options.content) apply(latestDoc.current)
  }, [apply])
  const noop = useCallback(() => {}, [])

  const line = statusLine(status)
  const sections = status?.sections ?? fetched?.sections ?? 0
  const savedAt = status?.savedAt ?? fetched?.savedAt

  return (
    <div className={styles.root} data-open={open || undefined} inert={!open}>
      <div className={styles.backdrop} onClick={onClose} />
      <aside
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-label="Конспект урока"
        tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.stopPropagation(); onClose() } }}
      >
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>Конспект урока</h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть панель">
              <XIcon size={16} strokeWidth={2.2} />
            </button>
          </div>
          <p className={styles.status} data-tone={line.tone} aria-live="polite">
            <span className={styles.dot} aria-hidden />
            {line.text}
          </p>
          {(sections > 0 || savedAt) && (
            <p className={styles.meta}>
              {sections > 0 && <span>{sectionsLabel(sections)}</span>}
              {savedAt && <span className={styles.saved}><HardDriveIcon size={12} aria-hidden /> Черновик сохранён в хранилище в {hhmm(savedAt)}</span>}
            </p>
          )}
          <div className={styles.tabs} role="tablist" aria-label="Содержимое панели">
            <button type="button" role="tab" aria-selected={tab === 'doc'} className={styles.tab} onClick={() => setTab('doc')}>
              <NotebookTextIcon size={14} aria-hidden /> Конспект
            </button>
            <button type="button" role="tab" aria-selected={tab === 'transcript'} className={styles.tab} onClick={() => setTab('transcript')}>
              <AudioLinesIcon size={14} aria-hidden /> Расшифровка
            </button>
          </div>
        </header>

        <div ref={scroller} className={styles.body} role="tabpanel" aria-label="Конспект" hidden={tab !== 'doc'}>
          {denied ? (
            <div className={styles.empty}>
              <p>Конспект видят только участники этого звонка</p>
            </div>
          ) : shown ? (
            <div className={styles.doc}>
              <LectureEditor lectureId={shown.id} initialDoc={shown.doc} editable={false} canUseAi={false} onReady={onReady} onChange={noop} />
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><NotebookPenIcon size={20} aria-hidden /></span>
              <p>Конспект появится через минуту после начала разговора</p>
            </div>
          )}
        </div>
        <div className={styles.body} role="tabpanel" aria-label="Расшифровка" hidden={tab !== 'transcript'}>
          {transcriptTab}
        </div>
      </aside>
    </div>
  )
}
