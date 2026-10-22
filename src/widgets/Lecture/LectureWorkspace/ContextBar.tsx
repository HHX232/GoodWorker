'use client'

import { parseContext, type LectureContext } from '@/shared/lib/lecture/context'
import { BookOpenIcon, ChevronRightIcon, PencilIcon, PinIcon, SparklesIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import styles from './LectureWorkspace.module.scss'

/**
 * What the lecture is about — subject › topic, the subtopics covered so far.
 * The AI fills it in while structuring and feeds it back into every prompt
 * (and the speech recogniser); the student can correct it, which pins it.
 */
export function ContextBar({ raw, onSave, editable }: { raw: unknown; onSave: (patch: { subject?: string; topic?: string; subtopics?: string[] }) => Promise<void>; editable: boolean }) {
  const t = useTranslations('lecture')
  const ctx: LectureContext = parseContext(raw)
  const [edit, setEdit] = useState<{ subject: string; topic: string; subtopics: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const empty = !ctx.subject && !ctx.topic && ctx.subtopics.length === 0
  const pin = (k: LectureContext['pinned'][number]) => ctx.pinned.includes(k) ? <PinIcon size={11} className={styles.ctxPin} aria-label={t('ctxPinned')} /> : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!edit) return
    setSaving(true)
    const patch: { subject?: string; topic?: string; subtopics?: string[] } = {}
    if (edit.subject.trim() !== ctx.subject) patch.subject = edit.subject.trim()
    if (edit.topic.trim() !== ctx.topic) patch.topic = edit.topic.trim()
    const subs = edit.subtopics.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
    if (subs.join('|') !== ctx.subtopics.join('|')) patch.subtopics = subs
    if (Object.keys(patch).length) await onSave(patch)
    setSaving(false)
    setEdit(null)
  }

  if (edit) {
    return (
      <form className={styles.ctxEdit} onSubmit={submit}>
        <label><span>{t('ctxSubject')}</span><input value={edit.subject} onChange={e => setEdit({ ...edit, subject: e.target.value })} maxLength={80} placeholder={t('ctxSubjectPh')} autoFocus /></label>
        <label><span>{t('ctxTopic')}</span><input value={edit.topic} onChange={e => setEdit({ ...edit, topic: e.target.value })} maxLength={160} placeholder={t('ctxTopicPh')} /></label>
        <label className={styles.ctxEditWide}><span>{t('ctxSubtopics')}</span><input value={edit.subtopics} onChange={e => setEdit({ ...edit, subtopics: e.target.value })} placeholder={t('ctxSubtopicsPh')} /></label>
        <p className={styles.ctxHint}>{t('ctxEditHint')}</p>
        <div className={styles.ctxActions}>
          <button type="button" className={styles.ctxBtn} onClick={() => setEdit(null)}>{t('cancel')}</button>
          <button type="submit" className={`${styles.ctxBtn} ${styles.ctxBtnPrimary}`} disabled={saving}>{t('save')}</button>
        </div>
      </form>
    )
  }

  return (
    <div className={styles.ctxBar}>
      <span className={styles.ctxIcon}>{empty ? <SparklesIcon size={14} /> : <BookOpenIcon size={14} />}</span>
      {empty ? (
        <span className={styles.ctxEmpty}>{t('ctxEmpty')}</span>
      ) : (
        <span className={styles.ctxMain}>
          {ctx.subject && <span className={styles.ctxSubject}>{ctx.subject}{pin('subject')}</span>}
          {ctx.subject && ctx.topic && <ChevronRightIcon size={13} className={styles.ctxSep} />}
          {ctx.topic && <span className={styles.ctxTopic}>{ctx.topic}{pin('topic')}</span>}
          {ctx.subtopics.length > 0 && (
            <span className={styles.ctxChips}>
              {ctx.subtopics.map(s => <span key={s} className={styles.ctxChip}>{s}</span>)}
              {pin('subtopics')}
            </span>
          )}
        </span>
      )}
      {editable && (
        <button type="button" className={styles.ctxEditBtn} onClick={() => setEdit({ subject: ctx.subject, topic: ctx.topic, subtopics: ctx.subtopics.join('; ') })} aria-label={t('ctxEdit')} title={t('ctxEdit')}>
          <PencilIcon size={13} /> {empty ? t('ctxSet') : null}
        </button>
      )}
    </div>
  )
}
