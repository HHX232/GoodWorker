// features/test-block-editor/ui/editors/InfoMediaEditor/InfoMediaEditor.tsx
'use client'
import { useActions } from '@/features/hooks/store/useActions'
import { InfoMediaKind, InfoMediaPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { ImageIcon, UploadIcon, VideoIcon, XIcon } from 'lucide-react'
import Image from 'next/image'
import { useRef } from 'react'
import styles from './InfoMediaEditor.module.scss'

interface Props {
  blockId: string
  payload: InfoMediaPayload
}

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

const toEmbedUrl = (url: string) => {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export const InfoMediaEditor = ({ blockId, payload }: Props) => {
  const { updateBlockPayload } = useActions()
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<InfoMediaPayload>) =>
    updateBlockPayload({ id: blockId, payload: { ...payload, ...patch } })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    const kind: InfoMediaKind = file.type.startsWith('video') ? 'video' : 'image'
    update({ kind, url: objectUrl })
  }

  const handleUrlInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (!val) { update({ url: null, kind: null }); return }
    const kind: InfoMediaKind = YOUTUBE_RE.test(val) ? 'video' : 'image'
    update({ url: val, kind })
  }

  const clear = () => {
    update({ url: null, kind: null, caption: null })
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasMedia = !!payload.url
  const embedUrl = payload.kind === 'video' && payload.url ? toEmbedUrl(payload.url) : null

  return (
    <div className={styles.box}>
      {!hasMedia && (
        <div className={styles.kind_row}>
          <button
            type="button"
            className={styles.kind_btn}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon size={16} />
            Загрузить файл
          </button>

          <span className={styles.or}>или вставить ссылку</span>

          <input
            className={styles.url_input}
            placeholder="https://youtube.com/watch?v=... или URL картинки"
            defaultValue={payload.url ?? ''}
            onBlur={handleUrlInput}
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className={styles.hidden}
            onChange={handleFileChange}
          />
        </div>
      )}

      {hasMedia && (
        <div className={styles.preview_box}>
          <button type="button" className={styles.clear_btn} onClick={clear}>
            <XIcon size={14} />
          </button>

          {payload.kind === 'image' && (
            <Image width={400} height={400} src={payload.url!} alt={payload.caption ?? ''} className={styles.preview_img} />
          )}

          {payload.kind === 'video' && embedUrl && (
            <iframe
              src={embedUrl}
              className={styles.preview_video}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}

          {payload.kind === 'video' && !embedUrl && (
            <video src={payload.url!} controls className={styles.preview_video} />
          )}

          <input
            className={styles.caption_input}
            placeholder="Подпись (необязательно)..."
            value={payload.caption ?? ''}
            onChange={(e) => update({ caption: e.target.value || null })}
          />
        </div>
      )}

      {!hasMedia && (
        <div className={styles.empty_hint}>
          <ImageIcon size={32} className={styles.empty_icon_img} />
          <VideoIcon size={32} className={styles.empty_icon_vid} />
          <p>Загрузите изображение или вставьте ссылку на видео</p>
        </div>
      )}
    </div>
  )
}