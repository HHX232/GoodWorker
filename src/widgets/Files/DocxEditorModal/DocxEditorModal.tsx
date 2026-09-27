'use client'

import '@docx-editor.dev/core/styles/editor.css'
import { DocxEditor, type DocxEditorRef } from '@docx-editor.dev/react'
import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FilesModal } from '../FilesModal/FilesModal'
import styles from './DocxEditorModal.module.scss'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * In-browser docx editing (docx-editor.dev — .docx bytes in, .docx bytes out,
 * fully client-side, no document server). The first save of a session creates
 * a new file next to the original (`onCreateDerived`); once that copy exists,
 * later saves in the same session overwrite it in place (`onOverwrite`)
 * instead of spawning another "(исправлено) (исправлено)" chain.
 */
export function DocxEditorModal({ file, onClose, onCreateDerived, onOverwrite }: {
  file: LibraryFile
  onClose: () => void
  /** First save of a session: uploads a brand-new file tagged as derived from `file.id`. */
  onCreateDerived: (file: File, derivedFromId: string) => Promise<LibraryFile | null>
  /** Later saves once a derived copy exists: overwrites its content in place. */
  onOverwrite: (fileId: string, file: File) => Promise<boolean>
}) {
  const t = useTranslations('files')
  const editorRef = useRef<DocxEditorRef>(null)
  const [target, setTarget] = useState(file)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tutor-files/files/${file.id}/content`)
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.arrayBuffer() })
      .then(buf => { if (!cancelled) setBytes(new Uint8Array(buf)) })
      .catch(e => { console.error('[DocxEditorModal] load failed', e); if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [file.id])

  const save = async () => {
    if (savingRef.current) return
    const buf = await editorRef.current?.save()
    if (!buf) return
    savingRef.current = true
    try {
      if (target.derivedFromId) {
        const ok = await onOverwrite(target.id, new File([buf], target.name, { type: DOCX_MIME }))
        if (ok) toast.success(t('editSaved'))
      } else {
        const name = `${target.name.replace(/\.docx$/i, '')} (${t('reuploadSuffix')}).docx`
        const created = await onCreateDerived(new File([buf], name, { type: DOCX_MIME }), target.id)
        if (created) { setTarget(created); toast.success(t('editSaved')) }
      }
    } catch (e) {
      console.error('[DocxEditorModal] save failed', e)
      toast.error(t('errGeneric'))
    } finally {
      savingRef.current = false
    }
  }

  return (
    <FilesModal size="viewer" closeLabel={t('close')} onClose={onClose} title={<span>{t('editTitle')} · {target.name}</span>}>
      <div className={styles.stage}>
        {loadFailed
          ? <p className={styles.error}>{t('errGeneric')}</p>
          : !bytes
            ? <div className={styles.loading}><span className={styles.spinner} /></div>
            : <DocxEditor ref={editorRef} document={bytes} mode="edit" title={target.name} onSave={save} />}
      </div>
    </FilesModal>
  )
}
