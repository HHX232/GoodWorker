'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { IconMinimize, IconXSmall } from '../icons'
import styles from './CallWhiteboard.module.scss'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
  { ssr: false, loading: () => <div className={styles.loading}>Загрузка доски…</div> },
)

interface Props {
  isOwner: boolean
  remoteElements: readonly ExcalidrawElement[] | null
  remoteFiles: BinaryFiles | null
  onBroadcast: (elements: readonly ExcalidrawElement[], files: BinaryFiles) => void
  onStop: () => void
  onHide?: () => void
}

export function CallWhiteboard({ isOwner, remoteElements, remoteFiles, onBroadcast, onStop, onHide }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBroadcast = useRef<readonly ExcalidrawElement[]>([])
  // Track which file IDs have already been sent to avoid re-broadcasting unchanged images
  const sentFilesRef = useRef<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  // Apply remote elements when they arrive (students only)
  useEffect(() => {
    if (!remoteElements || !apiRef.current || !ready) return
    const remoteMap = new Map(remoteElements.map(e => [e.id, e]))
    const current = apiRef.current.getSceneElements()
    const merged = remoteElements.slice()
    for (const el of current) {
      if (!remoteMap.has(el.id)) merged.push(el)
    }
    apiRef.current.updateScene({ elements: merged })
  }, [remoteElements, ready])

  // Apply remote image files when they arrive
  useEffect(() => {
    if (!remoteFiles || !apiRef.current || !ready) return
    const filesArray = Object.values(remoteFiles)
    if (filesArray.length > 0) {
      apiRef.current.addFiles(filesArray)
    }
  }, [remoteFiles, ready])

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _state: AppState, files: BinaryFiles) => {
      if (!isOwner) return
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
      broadcastTimer.current = setTimeout(() => {
        // Only include files that haven't been sent yet
        const newFiles: BinaryFiles = {}
        for (const [id, file] of Object.entries(files)) {
          if (!sentFilesRef.current.has(id)) {
            newFiles[id as keyof BinaryFiles] = file
            sentFilesRef.current.add(id)
          }
        }
        const hasNewElements = elements !== lastBroadcast.current
        const hasNewFiles = Object.keys(newFiles).length > 0
        if (hasNewElements || hasNewFiles) {
          lastBroadcast.current = elements
          onBroadcast(elements, newFiles)
        }
      }, 400)
    },
    [isOwner, onBroadcast],
  )

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>🎨 Доска</span>
        <div className={styles.headerActions}>
          {onHide && (
            <button className={styles.hideBtn} onClick={onHide} title="Свернуть"><IconMinimize /></button>
          )}
          {isOwner && (
            <button className={styles.stopBtn} onClick={onStop}><IconXSmall /> Завершить</button>
          )}
        </div>
      </div>

      <div className={styles.canvas}>
        <Excalidraw
          excalidrawAPI={api => { apiRef.current = api; setReady(true) }}
          onChange={handleChange}
          viewModeEnabled={!isOwner}
          isCollaborating={false}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              toggleTheme: false,
            },
          }}
        />
      </div>
    </div>
  )
}
