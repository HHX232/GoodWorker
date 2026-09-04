'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFileData, BinaryFiles, DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import styles from './CallWhiteboard.module.scss'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
  { ssr: false, loading: () => <div className={styles.loading}>Загрузка доски…</div> },
)

const FormulaKeyboard = dynamic(
  () => import('./FormulaKeyboard').then(m => ({ default: m.FormulaKeyboard })),
  { ssr: false },
)

interface Props {
  remoteElements: readonly ExcalidrawElement[] | null
  remoteFiles: BinaryFiles | null
  onBroadcast: (elements: readonly ExcalidrawElement[], files: BinaryFiles) => void
}

export function CallWhiteboard({ remoteElements, remoteFiles, onBroadcast }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBroadcast = useRef<readonly ExcalidrawElement[]>([])
  // Track which file IDs have already been sent to avoid re-broadcasting unchanged images
  const sentFilesRef = useRef<Set<string>>(new Set())
  // Prevents re-broadcasting when a remote update triggers onChange
  const isApplyingRemoteRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [showFormulaKeyboard, setShowFormulaKeyboard] = useState(false)
  const { isDark } = useThemeCtx()

  // Apply remote elements when they arrive
  useEffect(() => {
    if (!remoteElements || !apiRef.current || !ready) return
    const remoteMap = new Map(remoteElements.map(e => [e.id, e]))
    const current = apiRef.current.getSceneElements()
    const merged = remoteElements.slice()
    for (const el of current) {
      if (!remoteMap.has(el.id)) merged.push(el)
    }
    isApplyingRemoteRef.current = true
    apiRef.current.updateScene({ elements: merged })
    setTimeout(() => { isApplyingRemoteRef.current = false }, 0)
  }, [remoteElements, ready])

  // Apply remote image files when they arrive
  useEffect(() => {
    if (!remoteFiles || !apiRef.current || !ready) return
    const filesArray = Object.values(remoteFiles)
    if (filesArray.length > 0) {
      isApplyingRemoteRef.current = true
      apiRef.current.addFiles(filesArray)
      setTimeout(() => { isApplyingRemoteRef.current = false }, 0)
    }
  }, [remoteFiles, ready])

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _state: AppState, files: BinaryFiles) => {
      if (isApplyingRemoteRef.current) return
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
    [onBroadcast],
  )

  const handleInsertFormula = useCallback(async (dataUrl: string, width: number, height: number) => {
    if (!apiRef.current) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')

    const fileId = crypto.randomUUID() as FileId
    const fileData: BinaryFileData = {
      id: fileId,
      mimeType: 'image/png',
      dataURL: dataUrl as DataURL,
      created: Date.now(),
    }
    apiRef.current.addFiles([fileData])

    const { scrollX, scrollY, width: viewWidth, height: viewHeight } = apiRef.current.getAppState()
    const [imageElement] = convertToExcalidrawElements([
      {
        type: 'image',
        fileId,
        x: -scrollX + viewWidth / 2 - width / 2,
        y: -scrollY + viewHeight / 2 - height / 2,
        width,
        height,
      },
    ])

    apiRef.current.updateScene({ elements: [...apiRef.current.getSceneElements(), imageElement] })
    setShowFormulaKeyboard(false)
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.formulaButton}
          onClick={() => setShowFormulaKeyboard(v => !v)}
        >
          ∑ Формула
        </button>
        {showFormulaKeyboard && (
          <div className={styles.formulaPopover}>
            <FormulaKeyboard
              onInsert={handleInsertFormula}
              onClose={() => setShowFormulaKeyboard(false)}
            />
          </div>
        )}
      </div>
      <div className={styles.canvas}>
        <Excalidraw
          excalidrawAPI={api => { apiRef.current = api; setReady(true) }}
          onChange={handleChange}
          theme={isDark ? 'dark' : 'light'}
          viewModeEnabled={false}
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
