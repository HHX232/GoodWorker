'use client'

import React, { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import styles from './FormulaPhotoModal.module.scss'

interface Props {
  roomName?: string
  onRecognized: (latex: string) => void
  onClose: () => void
}

type Status = 'idle' | 'compressing' | 'recognizing'

export function FormulaPhotoModal({ roomName, onRecognized, onClose }: Props) {
  const t = useTranslations('whiteboard.formulaPhoto')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<string[] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const pickFile = useCallback((picked: File | null) => {
    setError(null)
    setCandidates(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (!picked) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (!picked.type.startsWith('image/')) {
      setError(t('needImage'))
      return
    }
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }, [previewUrl, t])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0] ?? null)
  }, [pickFile])

  const handleRecognize = useCallback(async () => {
    if (!file || status !== 'idle') return
    setError(null)
    setCandidates(null)
    try {
      setStatus('compressing')
      const compressed = await compressImageForUpload(file)

      setStatus('recognizing')
      const body = new FormData()
      body.append('photo', compressed)
      body.append('roomName', roomName ?? '')
      if (description.trim()) body.append('description', description.trim())

      const res = await fetch('/api/whiteboard/formula-photo', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('recognizeFailed'))

      if (data.needsClarification) {
        setCandidates(data.candidates)
        return
      }
      if (!data.latex) throw new Error(t('recognizeFailed'))
      onRecognized(data.latex)
    } catch (err) {
      console.error('[FormulaPhotoModal] recognize failed:', err)
      const message = err instanceof Error ? err.message : t('recognizeFailed')
      setError(message)
      toast.error(message)
    } finally {
      setStatus('idle')
    }
  }, [file, status, roomName, description, onRecognized, t])

  const busy = status !== 'idle'

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{t('title')}</div>

        {!previewUrl ? (
          <div
            className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className={styles.dropzoneIcon}>📷</span>
            <span>{t('dropzoneHint')}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.fileInput}
              onChange={e => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className={styles.previewWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element -- transient local object URL preview, not a served asset */}
            <img src={previewUrl} alt={t('previewAlt')} className={styles.preview} />
            <button type="button" className={styles.previewClear} onClick={() => pickFile(null)} disabled={busy} title={t('chooseAnother')}>
              ✕
            </button>
          </div>
        )}

        {candidates ? (
          <div className={styles.candidates}>
            <div className={styles.candidatesHint}>{t('multipleHint')}</div>
            {candidates.map((latex, i) => (
              <button key={i} type="button" className={styles.candidateItem} onClick={() => onRecognized(latex)}>
                {latex}
              </button>
            ))}
          </div>
        ) : (
          <input
            className={styles.descriptionInput}
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder={t('descriptionPlaceholder')}
            maxLength={300}
            disabled={busy}
          />
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {t('cancel')}
          </button>
          {!candidates && (
            <button type="button" className={styles.recognize} onClick={handleRecognize} disabled={!file || busy}>
              {status === 'compressing' ? t('compressing') : status === 'recognizing' ? t('recognizing') : t('recognize')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
