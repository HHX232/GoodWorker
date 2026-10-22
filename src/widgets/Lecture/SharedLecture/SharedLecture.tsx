'use client'

import type { Editor, JSONContent } from '@tiptap/core'
import { CheckIcon, EyeIcon, LoaderIcon, PencilIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { boardAccess } from '../board/BoardView'
import { stripPending } from '../editor/docOps'
import { LectureEditor } from '../editor/LectureEditor'
import { FormatPanel } from '../ui/FormatPanel'
import styles from './SharedLecture.module.scss'

interface SharedDoc { mode: 'view' | 'edit'; title: string; docVersion: number; docJson?: unknown }

const AUTOSAVE_MS = 1200
const POLL_MS = 4000

/**
 * A lecture opened by its public link (/lecture/shared/<token>), no login.
 * View link: the notes, read-only, filling in live while the owner records.
 * Edit link: the same editor without the AI; saves are versioned against the
 * owner's (whoever saves on a stale version gets the newer doc instead).
 */
export function SharedLecture({ token }: { token: string }) {
  const t = useTranslations('lecture')
  const [meta, setMeta] = useState<{ mode: 'view' | 'edit'; title: string } | null>(null)
  const [initialDoc, setInitialDoc] = useState<JSONContent | null | undefined>(undefined)
  const [missing, setMissing] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const version = useRef(0)
  const pending = useRef<JSONContent | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<Editor | null>(null)
  // All requests of the editor go to /api/lecture/shared/<token>/… (see LectureEditor's lectureId).
  const apiBase = `shared/${token}`

  // No AI on a link, whatever the viewer's own VIP.
  useEffect(() => { boardAccess.isVip = false; boardAccess.isAdmin = false }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/lecture/shared/${token}`).then(async res => {
      if (cancelled) return
      if (!res.ok) { setMissing(true); return }
      const data = (await res.json()) as SharedDoc
      version.current = data.docVersion
      setMeta({ mode: data.mode, title: data.title })
      setInitialDoc(stripPending((data.docJson as JSONContent | null) ?? null))
    }).catch(() => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [token])

  const showRemote = useCallback((doc: unknown, v: number) => {
    version.current = v
    const ed = editorRef.current
    if (ed && doc) ed.commands.setContent(stripPending(doc as JSONContent) ?? { type: 'doc', content: [] }, { emitUpdate: false })
  }, [])

  const saveRef = useRef<() => void>(() => {})
  const save = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const doc = pending.current
    if (!doc) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/lecture/shared/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docJson: doc, baseVersion: version.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        pending.current = null
        showRemote(data.docJson, Number(data.docVersion) || 0)
        setSaveState('saved')
        toast.info(t('shareConflict'))
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      version.current = Number(data.docVersion) || version.current
      if (pending.current === doc) pending.current = null
      setSaveState(pending.current ? 'dirty' : 'saved')
    } catch {
      // "Не сохранено — повторю": try again shortly (the doc stays pending).
      setSaveState('error')
      timer.current = setTimeout(() => saveRef.current(), 3000)
    }
  }, [showRemote, t, token])
  useEffect(() => { saveRef.current = save }, [save])

  const onChange = useCallback((doc: JSONContent) => {
    if (meta?.mode !== 'edit') return
    pending.current = doc
    setSaveState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, AUTOSAVE_MS)
  }, [meta?.mode, save])

  // Others' changes (the owner recording, other editors) — pulled while nothing of ours is unsaved.
  useEffect(() => {
    if (!meta) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible' || pending.current || timer.current) return
      const res = await fetch(`/api/lecture/shared/${token}?since=${version.current}`).catch(() => null)
      if (res?.status === 404) { setMissing(true); return }
      const data = res?.ok ? ((await res.json().catch(() => null)) as SharedDoc | null) : null
      if (data && 'docJson' in data && !pending.current) showRemote(data.docJson, data.docVersion)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [meta, showRemote, token])

  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden' && pending.current) save() }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [save])

  if (missing) {
    return (
      <div className={styles.page}>
        <div className={styles.gone}><strong>{t('shareGoneTitle')}</strong><p>{t('shareGoneText')}</p></div>
      </div>
    )
  }
  if (!meta || initialDoc === undefined) return <div className={styles.page}><div className={styles.skeleton} aria-busy="true" /></div>

  const edit = meta.mode === 'edit'
  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <h1 className={styles.title}>{meta.title || t('untitled')}</h1>
        <span className={`${styles.badge} ${edit ? styles.badgeEdit : ''}`}>
          {edit ? <PencilIcon size={13} /> : <EyeIcon size={13} />} {t(edit ? 'shareEdit' : 'shareView')}
        </span>
        {edit && (
          <span className={styles.saveState}>
            {saveState === 'saving' ? <><LoaderIcon size={13} className={styles.spin} /> {t('saving')}</>
              : saveState === 'error' ? t('saveError')
              : saveState === 'saved' ? <><CheckIcon size={13} /> {t('saved')}</> : null}
          </span>
        )}
      </div>
      {edit && <div className={styles.tools}><FormatPanel editor={editor} compact /></div>}
      <div className={styles.card}>
        <LectureEditor
          lectureId={apiBase}
          initialDoc={initialDoc as never}
          editable={edit}
          canUseAi={false}
          onReady={e => { editorRef.current = e; setEditor(e) }}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
