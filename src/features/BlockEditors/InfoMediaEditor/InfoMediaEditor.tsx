'use client'
import { InfoMediaKind, InfoMediaPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { ImageIcon, UploadIcon, VideoIcon, XIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef } from 'react'
import styles from './InfoMediaEditor.module.scss'

interface Props {
  payload: InfoMediaPayload
  onChange?: (payload: InfoMediaPayload) => void
  viewOnly?: boolean
}

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

const toEmbedUrl = (url: string) => {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export const InfoMediaEditor = ({payload, onChange, viewOnly = false}: Props) => {
  const editable = !!onChange && !viewOnly
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<InfoMediaPayload>) => onChange?.({...payload, ...patch})

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const kind: InfoMediaKind = file.type.startsWith('video') ? 'video' : 'image'
    const reader = new FileReader()
    reader.onload = () => update({kind, url: reader.result as string})
    reader.readAsDataURL(file)
  }

  const handleUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (!val) {
      update({url: null, kind: null})
      return
    }
    const kind: InfoMediaKind = YOUTUBE_RE.test(val) ? 'video' : 'image'
    update({url: val, kind})
  }

  const clear = () => {
    update({url: null, kind: null, caption: null})
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasMedia = !!payload.url
  const embedUrl = payload.kind === 'video' && payload.url ? toEmbedUrl(payload.url) : null

  // ── View only ─────────────────────────────────────────────

  if (!editable) {
    if (!payload.url) return null
    return (
      <div className={styles.preview_box}>
  {payload.kind === 'image' && (
    <div className={styles.image_wrapper}>
      <img src={payload.url!} alt='' className={styles.image_bg_blur} aria-hidden />
      <Image
        width={800}
        height={600}
        src={payload.url!}
        alt={payload.caption ?? ''}
        className={styles.preview_img}
      />
      {payload.caption && (
        <p className={styles.caption_text}>{payload.caption }</p>
      )}
    </div>
  )}
  {payload.kind === 'video' && embedUrl && (
    <iframe
      src={embedUrl}
      className={styles.preview_video}
      allowFullScreen
      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    />
  )}
  {payload.kind === 'video' && !embedUrl && (
    <video src={payload.url} controls className={styles.preview_video} />
  )}
  {payload.kind === 'video' && payload.caption && (
    <p className={styles.caption_text}>{payload.caption}</p>
  )}
</div>
    )
  }

  return (
    <div className={styles.box}>
      {!hasMedia && (
        <>
          <div className={styles.kind_row}>
            <button type='button' className={styles.kind_btn} onClick={() => fileRef.current?.click()}>
              <UploadIcon size={16} />
              Загрузить файл
            </button>
            <span className={styles.or}>или вставить ссылку</span>
            <input
              className={styles.url_input}
              placeholder='https://youtube.com/watch?v=... или URL картинки'
              defaultValue={payload.url ?? ''}
              onBlur={handleUrlInput}
            />
            <input
              ref={fileRef}
              type='file'
              accept='image/*,video/*'
              className={styles.hidden}
              onChange={handleFileChange}
            />
          </div>
          <div className={styles.empty_hint}>
            <ImageIcon size={32} className={styles.empty_icon_img} />
            <VideoIcon size={32} className={styles.empty_icon_vid} />
            <p>Загрузите изображение или вставьте ссылку на видео</p>
          </div>
        </>
      )}

      {hasMedia && (
        <div className={styles.preview_box}>
          <button type='button' className={styles.clear_btn} onClick={clear}>
            <XIcon size={14} />
          </button>
          {payload.kind === 'image' && (
            <Image
              width={400}
              height={400}
              src={payload.url!}
              alt={payload.caption ?? ''}
              className={styles.preview_img}
            />
          )}
          {payload.kind === 'video' && embedUrl && (
            <iframe
              src={embedUrl}
              className={styles.preview_video}
              allowFullScreen
              allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            />
          )}
          {payload.kind === 'video' && !embedUrl && (
            <video src={payload.url!} controls className={styles.preview_video} />
          )}
          <input
            className={styles.caption_input}
            placeholder='Подпись (необязательно)...'
            value={payload.caption ?? ''}
            onChange={(e) => update({caption: e.target.value || null})}
          />
        </div>
      )}
    </div>
  )
}
