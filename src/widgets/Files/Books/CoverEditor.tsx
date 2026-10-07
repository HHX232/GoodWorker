'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { FilesCheckIcon, FilesCoverIcon, FilesUndoIcon } from '../icons'
import ui from '../ui.module.scss'
import { SPINE_PRESETS, inkOn, safeSpine } from './bookColor'
import type { BookCoverKind } from './bookFetch'
import { BookCover } from './BookCover'
import { CENTERED, coverBlob, coverDataUrl, loadImage, type CoverCrop, type CoverSource } from './coverCanvas'
import { MAX_ZOOM, MIN_ZOOM } from './cover-crop'
import styles from './CoverEditor.module.scss'

/** The picture on the cover. `getBlob` renders the file to upload; null = the picture the book already has (nothing to upload). */
export interface CoverImage {
  kind: BookCoverKind
  previewUrl: string
  getBlob: (() => Promise<Blob>) | null
}

export interface CoverValue {
  spineColor: string
  image: CoverImage | null
}

export interface CoverEditorProps {
  title: string
  value: CoverValue
  onChange: (value: CoverValue) => void
  /** Page 1 as a ready 2:3 cover. Without it the "reset to page 1" button is not shown. */
  loadPage1?: () => Promise<{ blob: Blob; previewUrl: string }>
  /** A picture already chosen by the caller (the upload modal's "Загрузить обложку") — opened on mount. */
  initialPhoto?: File | null
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const COLOR_KEYS = ['booksKitColor0', 'booksKitColor1', 'booksKitColor2', 'booksKitColor3', 'booksKitColor4', 'booksKitColor5', 'booksKitColor6', 'booksKitColor7', 'booksKitColor8', 'booksKitColor9'] as const

interface Photo { src: CoverSource; crop: CoverCrop }

/** Colour of the book + a photo framed to 2:3 (zoom, shift), with a live preview of the finished book. */
export function CoverEditor({ title, value, onChange, loadPage1, initialPhoto }: CoverEditorProps) {
  const t = useTranslations('files')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value })
  // Every picture change (new photo, slider, reset, remove) takes a number; a slow loadImage / loadPage1 that comes back after a newer change is dropped.
  const seq = useRef(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const applyPhoto = (p: Photo) => {
    seq.current++
    setPhoto(p)
    onChange({
      ...valueRef.current,
      image: { kind: 'photo', previewUrl: coverDataUrl(p.src, p.crop), getBlob: () => coverBlob(p.src, p.crop) },
    })
  }

  const openFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) { setError(t('booksKitPhotoNotImage', { name: file.name })); return }
    if (file.size > MAX_PHOTO_BYTES) { setError(t('booksKitPhotoTooBig')); return }
    const my = ++seq.current
    try {
      const { img, width, height } = await loadImage(file)
      if (my !== seq.current || !alive.current) return
      applyPhoto({ src: { source: img, width, height }, crop: CENTERED })
    } catch {
      if (my === seq.current && alive.current) setError(t('booksKitPhotoOpenFailed'))
    }
  }

  // The caller may keep this editor mounted and hand it another picture later (the upload modal does).
  useEffect(() => { if (initialPhoto) void openFile(initialPhoto) }, [initialPhoto]) // eslint-disable-line react-hooks/exhaustive-deps

  const setCrop = (patch: Partial<CoverCrop>) => { if (photo) applyPhoto({ ...photo, crop: { ...photo.crop, ...patch } }) }

  const resetToPage1 = async () => {
    if (!loadPage1) return
    const my = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const page1 = await loadPage1()
      if (my !== seq.current || !alive.current) return
      setPhoto(null)
      onChange({ ...valueRef.current, image: { kind: 'page1', previewUrl: page1.previewUrl, getBlob: async () => page1.blob } })
    } catch {
      if (my === seq.current && alive.current) setError(t('booksKitPage1Failed'))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const spine = safeSpine(value.spineColor)
  const img = value.image
  const showSliders = !!photo && img?.kind === 'photo'
  const preview = { title, spineColor: spine, coverUrl: img?.previewUrl ?? null, coverKind: img?.kind ?? null }

  const slider = (key: 'zoom' | 'x' | 'y', label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
    const id = `ce-${key}`
    const v = photo?.crop[key] ?? 0
    return (
      <div className={styles.ctl}>
        <label htmlFor={id}>{label}</label>
        <input id={id} type="range" min={min} max={max} step={step} value={v} onChange={e => setCrop({ [key]: parseFloat(e.target.value) })} />
        <output htmlFor={id}>{fmt(v)}</output>
      </div>
    )
  }

  return (
    <div className={styles.ce}>
      <div className={styles.prev}>
        <BookCover {...preview} size="lg" />
        <div className={styles.cap}>
          <BookCover {...preview} size="sm" />
          <span>{t('booksKitPreviewCaption')}</span>
        </div>
      </div>

      <div className={styles.ctls}>
        <section>
          <h3>{t('booksKitColorTitle')}</h3>
          <p className={styles.hint}>{t('booksKitColorHint')}</p>
          <div className={styles.sw} role="group" aria-label={t('booksKitColorTitle')}>
            {SPINE_PRESETS.map((c, i) => {
              const on = spine.toLowerCase() === c
              return (
                <button key={c} type="button" className={styles.swb} style={{ background: c, color: inkOn(c) }} aria-pressed={on} aria-label={t(COLOR_KEYS[i])} title={t(COLOR_KEYS[i])} onClick={() => onChange({ ...value, spineColor: c })}>
                  {on && <FilesCheckIcon size={16} strokeWidth={3} />}
                </button>
              )
            })}
            <label className={styles.swc}>
              <input type="color" value={spine} onChange={e => onChange({ ...value, spineColor: e.target.value })} aria-label={t('booksKitColorCustom')} />
              {t('booksKitColorCustom')}
            </label>
          </div>
        </section>

        <section>
          <h3>{t('booksKitPhotoTitle')}</h3>
          <p className={styles.hint}>{t('booksKitPhotoHint')}</p>
          <div className={styles.row}>
            <button type="button" className={ui.btn} onClick={() => inputRef.current?.click()}>
              <FilesCoverIcon size={16} />
              {img?.kind === 'photo' ? t('booksKitPhotoReplace') : t('booksKitPhoto')}
            </button>
            {img && <button type="button" className={ui.btn} onClick={() => { seq.current++; setPhoto(null); setBusy(false); onChange({ ...value, image: null }) }}>{t('booksKitPhotoRemove')}</button>}
          </div>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { void openFile(e.target.files?.[0]); e.target.value = '' }} />
          {error && <div className={ui.error} role="alert">{error}</div>}
          {showSliders && (
            <div className={styles.sliders}>
              {slider('zoom', t('booksKitZoom'), MIN_ZOOM, MAX_ZOOM, 0.05, v => `×${v.toFixed(2).replace(/\.?0+$/, '')}`)}
              {slider('x', t('booksKitShiftX'), -100, 100, 1, v => `${v}`)}
              {slider('y', t('booksKitShiftY'), -100, 100, 1, v => `${v}`)}
            </div>
          )}
        </section>

        {loadPage1 && (
          <section>
            <button type="button" className={ui.btn} onClick={resetToPage1} disabled={busy || img?.kind === 'page1'}>
              <FilesUndoIcon size={16} />
              {busy ? t('booksKitLoading') : t('booksKitResetPage1')}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
