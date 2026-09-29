'use client'

import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  AlertTriangleIcon, AudioLinesIcon, ChevronLeftIcon, CloudOffIcon, CrownIcon, DownloadIcon, FileTextIcon, FolderInputIcon, MicIcon, NotebookPenIcon,
  PrinterIcon, ScrollTextIcon, SparklesIcon, SquareIcon, WandSparklesIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { collectNotes } from '../editor/docOps'
import { LectureEditor } from '../editor/LectureEditor'
import { lectureRecorder } from '../recorder/lectureRecorder'
import { AiOrb, type OrbMode } from '../ui/AiOrb'
import { FormatPanel } from '../ui/FormatPanel'
import { TranscriptModal } from './TranscriptModal'
import { formatClock } from './format'
import { useLectureSession } from './useLectureSession'
import styles from './LectureWorkspace.module.scss'

/**
 * /lecture/[id] — three columns (after the Scribe reference):
 *   left   — the AI orb (what the AI is doing right now), recording and AI controls, live transcript;
 *   centre — the document card;
 *   right  — recording stats and price, export (files / Word / PDF / audio), text tools, notes.
 * Below 1100px the columns stack: a compact recording bar, the document, then the panels.
 */
export function LectureWorkspace({ lectureId }: { lectureId: string }) {
  const t = useTranslations('lecture')
  const s = useLectureSession(lectureId, t as unknown as (k: string, v?: Record<string, string | number>) => string)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [exporting, setExporting] = useState<null | 'files' | 'word'>(null)

  const onReady = useCallback((e: Editor) => { setEditor(e); s.onEditorReady(e) }, [s])

  const docStats = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { words: 0, formulas: 0, notes: [] as ReturnType<typeof collectNotes> }
      let formulas = 0
      e.state.doc.descendants(n => { if (n.type.name === 'mathInline' || n.type.name === 'mathBlock') formulas++ })
      const words = e.state.doc.textContent.split(/\s+/).filter(Boolean).length
      return { words, formulas, notes: collectNotes(e.state.doc) }
    },
  })

  const rec = s.recorder
  const recording = s.isRecordingHere
  const elapsed = recording ? rec.elapsedMs : s.lecture?.recordedMs ?? 0
  const hasAudio = useMemo(() => s.chunks.some(c => c.hasAudio), [s.chunks])
  const canUseAi = s.access

  const orbMode: OrbMode =
    rec.error && rec.lectureId === lectureId ? 'error'
      : s.issue === 'offline' ? 'offline'
      : s.lecture?.status === 'FINALIZING' || s.refining ? 'finalizing'
      : s.structuring || s.stopping ? 'thinking'
      : recording ? 'listening'
      : 'idle'

  const status =
    orbMode === 'error' ? t('stateError')
      : orbMode === 'offline' ? t('stateOffline', { n: s.queued })
      : orbMode === 'finalizing' ? (s.refining ? t('stateRefining') : t('stateFinalizing'))
      : s.stopping ? t('stateStopping')
      : s.structuring ? t('stateStructuring')
      : recording ? (s.issue === 'busy' || s.issue === 'stt' ? t('stateSttBusy') : t('stateListening'))
      : s.lecture?.status === 'READY' ? t('stateReady')
      : t('stateIdle')

  const pending = s.pendingRange()

  const exportDocx = async (save: boolean) => {
    setExporting(save ? 'files' : 'word')
    try {
      await s.flushSave()
      const res = await fetch(`/api/lecture/${lectureId}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'EXPORT_FAILED')
      }
      if (save) {
        const data = await res.json()
        toast.success(t('savedToFiles'), { action: { label: t('openFiles'), onClick: () => { window.location.href = data.where === 'drive' ? `/files?tab=mine&folder=${data.file.folderId ?? ''}` : `/files?folder=${data.file.folderId ?? ''}` } } })
      } else {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${s.lecture?.title || 'lecture'}.docx`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      toast.error(code === 'VIP_REQUIRED' ? t('vipOnly') : code === 'QUOTA_EXCEEDED' ? t('quotaExceeded') : t('exportFailed'))
    } finally {
      setExporting(null)
    }
  }

  const printPdf = () => {
    document.body.classList.add('lecture-print')
    const done = () => { document.body.classList.remove('lecture-print'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  if (s.loadError) {
    return (
      <div className={styles.center}>
        <p>{t('loadFailed')}</p>
        <Link href="/lecture" className={styles.linkBtn}>{t('backToList')}</Link>
      </div>
    )
  }
  if (!s.lecture || s.initialDoc === undefined) return <div className={styles.page}><div className={styles.loadingCard} aria-busy="true" /></div>

  const lecture = s.lecture
  const cost = (lecture.costKopecks / 100).toFixed(2)
  const liveChunks = s.chunks.slice(-5)

  const recordButton = recording
    ? <button type="button" className={`${styles.recBtn} ${styles.recStop}`} onClick={s.stopRecording} disabled={s.stopping}><SquareIcon size={16} fill="currentColor" /> {t('stop')}</button>
    : <button type="button" className={styles.recBtn} onClick={s.startRecording} disabled={!s.access || !s.sttConfigured || s.stopping || lecture.status === 'FINALIZING'}>
        <MicIcon size={17} /> {lecture.recordedMs > 0 ? t('resume') : t('start')}
      </button>

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* ── Left: AI orb + controls ── */}
        <aside className={styles.left}>
          <Link href="/lecture" className={styles.back}><ChevronLeftIcon size={16} /> {t('allLectures')}</Link>
          <div className={styles.orbBlock}>
            <AiOrb mode={orbMode} level={recording ? rec.level : 0} size={176} label={status} />
            <div className={styles.orbInfo}>
              <div className={styles.clock}>{formatClock(elapsed)}</div>
              <div className={styles.status}>{status}</div>
            </div>
          </div>

          <div className={styles.controls}>
            {recordButton}
            {!s.access && <Link href="/vip" className={styles.vipNote}><CrownIcon size={14} /> {t('vipRequired')}</Link>}
            {s.access && !s.sttConfigured && <p className={styles.warn}><AlertTriangleIcon size={14} /> {t('sttNotConfigured')}</p>}
          </div>

          <div className={styles.aiControls}>
            <div className={styles.railLabel}><SparklesIcon size={13} /> {t('aiControls')}</div>
            <label className={styles.switchRow}>
              <span>{t('autoStructure')}</span>
              <input type="checkbox" className={styles.switch} checked={s.autoStructure} onChange={e => { s.setAutoStructure(e.target.checked); if (e.target.checked) s.structureNow() }} />
            </label>
            <button type="button" className={styles.railBtn} disabled={!pending || s.structuring || !canUseAi} onClick={s.structureNow}>
              <WandSparklesIcon size={15} /> {t('structureNow')}{pending ? <span className={styles.badge}>{formatClock(pending.ms)}</span> : null}
            </button>
            {!recording && lecture.status === 'RECORDING' && lecture.recordedMs > 0 && (
              <button type="button" className={styles.railBtn} disabled={!canUseAi} onClick={s.finalize}>
                <AudioLinesIcon size={15} /> {t('finalizeNow')}
              </button>
            )}
            <label className={styles.switchRow}>
              <span>{t('keepAudio')}<small>{t('keepAudioHint')}</small></span>
              <input type="checkbox" className={styles.switch} checked={lecture.keepAudio} onChange={e => s.setKeepAudio(e.target.checked)} />
            </label>
          </div>

          <div className={styles.feed}>
            <div className={styles.railLabel}><ScrollTextIcon size={13} /> {t('liveTranscript')}</div>
            {liveChunks.length === 0
              ? <p className={styles.feedEmpty}>{recording ? t('feedWaiting') : t('feedEmpty')}</p>
              : liveChunks.map(c => (
                  <p key={c.seq} className={styles.feedLine}>
                    <span className={styles.feedTime}>{formatClock(c.startMs)}</span>
                    {c.text.replace(/⟨\?([^⟩]*)⟩/g, '$1') || '…'}
                  </p>
                ))}
            {s.chunks.length > 0 && <button type="button" className={styles.linkBtn} onClick={() => setTranscriptOpen(true)}>{t('fullTranscript')}</button>}
          </div>

          {rec.wasHidden && recording && (
            <div className={styles.alert} role="alert">
              <AlertTriangleIcon size={15} /> <span>{t('hiddenWarning')}</span>
              <button type="button" onClick={() => lectureRecorder.dismissHiddenWarning()}>{t('ok')}</button>
            </div>
          )}
          {s.queued > 0 && (
            <div className={styles.queue}><CloudOffIcon size={14} /> {t('queued', { n: s.queued })}</div>
          )}
        </aside>

        {/* ── Centre: the document ── */}
        <main className={styles.center}>
          <div className={`${styles.docCard} ${styles.printArea}`}>
            <div className={styles.docHead}>
              <span className={styles.crumb}>{t('crumb')}</span>
              <span className={styles.crumbSep}>/</span>
              <input
                className={styles.titleInput}
                defaultValue={lecture.title}
                placeholder={t('untitled')}
                maxLength={200}
                onBlur={e => { if (e.target.value.trim() !== lecture.title) s.setTitle(e.target.value.trim()) }}
                aria-label={t('titleLabel')}
              />
              <span className={`${styles.saveState} ${s.saveState === 'error' ? styles.saveError : ''}`}>
                {s.saveState === 'saving' ? t('saving') : s.saveState === 'dirty' ? t('unsaved') : s.saveState === 'error' ? t('saveError') : t('saved')}
              </span>
            </div>
            <h1 className={styles.printTitle}>{lecture.title || t('untitled')}</h1>
            <LectureEditor lectureId={lectureId} initialDoc={s.initialDoc as never} editable canUseAi={canUseAi} onReady={onReady} onChange={s.onDocChange} />
          </div>
        </main>

        {/* ── Right: stats, export, text tools, notes ── */}
        <aside className={styles.right}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>{t('recording')}</div>
            <dl className={styles.stats}>
              <div><dt>{t('statDuration')}</dt><dd>{formatClock(elapsed)}</dd></div>
              <div><dt>{t('statChunks')}</dt><dd>{s.chunks.length}{s.chunks.some(c => c.isFinal) ? <small> · {t('statFinal', { n: s.chunks.filter(c => c.isFinal).length })}</small> : null}</dd></div>
              <div><dt>{t('statAudio')}</dt><dd>{lecture.keepAudio ? t('statAudioKept') : hasAudio ? t('statAudioTemp') : '—'}</dd></div>
              <div><dt>{t('statWords')}</dt><dd>{docStats?.words ?? 0}</dd></div>
              <div><dt>{t('statFormulas')}</dt><dd>{docStats?.formulas ?? 0}</dd></div>
              <div><dt>{t('statCost')}</dt><dd>{s.isAdmin ? t('costAdmin') : `${cost} ₽`}{!s.isAdmin && !s.tariff?.billingEnabled ? <small>{t('costNotCharged')}</small> : null}</dd></div>
            </dl>
            {s.tariff && !s.isAdmin && (
              <p className={styles.tariffLine}>{t('tariffLine', { base: s.tariff.baseMinutes, basePrice: (s.tariff.basePer5MinKopecks / 100).toFixed(0), extra: (s.tariff.extraPer5MinKopecks / 100).toFixed(0), markup: s.tariff.aiMarkup })}</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{t('export')}</div>
            <div className={styles.exportGrid}>
              <button type="button" className={`${styles.exportBtn} ${styles.exportPrimary}`} disabled={!!exporting} onClick={() => exportDocx(true)}>
                <FolderInputIcon size={18} /> <span>{exporting === 'files' ? t('saving') : lecture.fileId ? t('updateInFiles') : t('saveToFiles')}</span>
              </button>
              <button type="button" className={styles.exportBtn} disabled={!!exporting} onClick={() => exportDocx(false)}><FileTextIcon size={18} /> <span>{exporting === 'word' ? t('saving') : 'Word'}</span></button>
              <button type="button" className={styles.exportBtn} onClick={printPdf}><PrinterIcon size={18} /> <span>PDF</span></button>
              <a className={`${styles.exportBtn} ${hasAudio ? '' : styles.exportDisabled}`} href={hasAudio ? `/api/lecture/${lectureId}/audio` : undefined} aria-disabled={!hasAudio} title={hasAudio ? undefined : t('noAudio')}>
                <DownloadIcon size={18} /> <span>{t('audio')}</span>
              </a>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>{t('textTools')}</div>
            <FormatPanel editor={editor} />
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}><NotebookPenIcon size={14} /> {t('notes')} <span className={styles.count}>{docStats?.notes.length ?? 0}</span></div>
            {docStats?.notes.length
              ? <ul className={styles.notes}>
                  {docStats.notes.map(n => (
                    <li key={n.id}>
                      <button type="button" onClick={() => { editor?.chain().focus().setTextSelection(n.pos).scrollIntoView().run() }}>
                        <span className={styles.noteQuote}>«{n.quote.slice(0, 60)}»</span>
                        <span className={styles.noteText}>{n.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              : <p className={styles.muted}>{t('notesEmpty')}</p>}
          </section>
        </aside>
      </div>

      {transcriptOpen && <TranscriptModal lectureId={lectureId} chunks={s.chunks} onClose={() => setTranscriptOpen(false)} />}
    </div>
  )
}

