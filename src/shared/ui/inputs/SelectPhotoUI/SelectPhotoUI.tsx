'use client'

import { useRef, useState, useId } from 'react'
import Image from 'next/image'
import styles from './SelectPhotoUI.module.scss'

interface PhotoFile {
  id: string
  url: string
  file: File
}

interface Props {
  value: string
  onTextChange: (v: string) => void
  photos: PhotoFile[]
  onPhotosChange: (photos: PhotoFile[]) => void
  placeholder?: string
  maxPhotos?: number
  disabled?: boolean
}

const MAX_DEFAULT = 4

export function SelectPhotoUI({
  value,
  onTextChange,
  photos,
  onPhotosChange,
  placeholder = 'Write something...',
  maxPhotos = MAX_DEFAULT,
  disabled = false,
}: Props) {
  const fileId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const slots = maxPhotos - photos.length
    if (slots <= 0) return
    const newPhotos: PhotoFile[] = arr.slice(0, slots).map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(f),
      file: f,
    }))
    onPhotosChange([...photos, ...newPhotos])
  }

  const remove = (id: string) => {
    const p = photos.find(x => x.id === id)
    if (p) URL.revokeObjectURL(p.url)
    onPhotosChange(photos.filter(x => x.id !== id))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(null)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const slots = Array.from({ length: maxPhotos })

  return (
    <div className={`${styles.wrap} ${disabled ? styles.disabled : ''}`}>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={e => onTextChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
      />

      <div className={styles.grid}>
        {slots.map((_, i) => {
          const photo = photos[i]
          if (photo) {
            return (
              <div
                key={photo.id}
                className={styles.cell}
                draggable
                onDragStart={() => setDragging(photo.id)}
                onDragEnd={() => setDragging(null)}
              >
                <Image src={photo.url} alt="" fill className={styles.img} />
                <button
                  type="button"
                  className={styles.del}
                  onClick={() => remove(photo.id)}
                  aria-label="Remove"
                  disabled={disabled}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          }

          if (i === photos.length) {
            return (
              <label
                key={`slot-${i}`}
                htmlFor={fileId}
                className={`${styles.cell} ${styles.add} ${dragging ? styles.drop_target : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging('over') }}
                onDragLeave={() => setDragging(null)}
                onDrop={onDrop}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </label>
            )
          }

          return (
            <div key={`empty-${i}`} className={`${styles.cell} ${styles.empty_slot}`} />
          )
        })}
      </div>

      <input
        id={fileId}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hidden}
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }}
        disabled={disabled}
      />
    </div>
  )
}
