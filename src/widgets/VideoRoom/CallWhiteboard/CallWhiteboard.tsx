'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFileData, BinaryFiles, DataURL, ExcalidrawImperativeAPI, Zoom } from '@excalidraw/excalidraw/types'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { GridSettingsPanel, DEFAULT_GRID_SETTINGS, type GridSettings } from './GridSettingsPanel'
import { ElementInspector } from './ElementInspector'
import { PRIMITIVE_LABELS, type ThreeDInsertPayload, type ThreeDShapeMeta } from './shapeGeometry'
import type { ViewTransform } from './ShapeInteractionLayer'
import styles from './CallWhiteboard.module.scss'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
  { ssr: false, loading: () => <div className={styles.loading}>Загрузка доски…</div> },
)

const FormulaKeyboard = dynamic(
  () => import('./FormulaKeyboard').then(m => ({ default: m.FormulaKeyboard })),
  { ssr: false },
)

const ThreeDPanel = dynamic(
  () => import('./ThreeDPanel').then(m => ({ default: m.ThreeDPanel })),
  { ssr: false },
)

const ShapeInteractionLayer = dynamic(
  () => import('./ShapeInteractionLayer').then(m => ({ default: m.ShapeInteractionLayer })),
  { ssr: false },
)

const GRID_STORAGE_KEY = 'whiteboard:gridSettings'
const GRID_STYLES = new Set(['squares', 'dots', 'lines', 'off'])
const DEFAULT_ZOOM: Zoom = { value: 1 as AppState['zoom']['value'] }

type PopoverKind = 'formula' | 'grid' | '3d' | null

interface EditingFormula {
  id: string
  latex: string
  color: string
  label?: string
  x: number
  y: number
  width: number
  height: number
}

interface EditingShape {
  elementIds: string[]
  meta: ThreeDShapeMeta
  bbox: { x: number; y: number; width: number; height: number }
}

interface InspectorTarget {
  kind: 'formula' | 'shape'
  elementIds: string[]
  label: string
  bbox: { x: number; y: number; width: number; height: number }
}

interface Props {
  remoteElements: readonly ExcalidrawElement[] | null
  remoteFiles: BinaryFiles | null
  onBroadcast: (elements: readonly ExcalidrawElement[], files: BinaryFiles) => void
  roomName?: string
  isVip?: boolean
  isAdmin?: boolean
}

export function CallWhiteboard({ remoteElements, remoteFiles, onBroadcast, roomName, isVip, isAdmin }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBroadcast = useRef<readonly ExcalidrawElement[]>([])
  // Track which file IDs have already been sent to avoid re-broadcasting unchanged images
  const sentFilesRef = useRef<Set<string>>(new Set())
  // Prevents re-broadcasting when a remote update triggers onChange
  const isApplyingRemoteRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [activePopover, setActivePopover] = useState<PopoverKind>(null)
  const [editingFormula, setEditingFormula] = useState<EditingFormula | null>(null)
  const [editingShape, setEditingShape] = useState<EditingShape | null>(null)
  const [autoOpenAi, setAutoOpenAi] = useState(false)
  const [gridSettings, setGridSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS)
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scrollX: 0, scrollY: 0, zoom: DEFAULT_ZOOM, offsetLeft: 0, offsetTop: 0 })
  const [constructionMode, setConstructionMode] = useState(false)
  const [sceneElements, setSceneElements] = useState<readonly ExcalidrawElement[]>([])
  const [selectedElementIds, setSelectedElementIds] = useState<Record<string, boolean>>({})
  const { isDark } = useThemeCtx()

  const inspectorTarget = useMemo<InspectorTarget | null>(() => {
    const ids = Object.keys(selectedElementIds).filter(id => selectedElementIds[id])
    if (ids.length === 0) return null
    const selected = sceneElements.filter(el => ids.includes(el.id) && !el.isDeleted)
    if (selected.length === 0) return null

    if (selected.length === 1 && selected[0].type === 'image') {
      const el = selected[0]
      const customData = (el as unknown as { customData?: { formulaLatex?: string; label?: string } }).customData
      if (typeof customData?.formulaLatex === 'string') {
        return {
          kind: 'formula',
          elementIds: [el.id],
          label: customData.label ?? 'Формула',
          bbox: { x: el.x, y: el.y, width: el.width, height: el.height },
        }
      }
      return null
    }

    const shapeIds = new Set(
      selected
        .map(el => (el as unknown as { customData?: { threeDShape?: ThreeDShapeMeta } }).customData?.threeDShape?.shapeId)
        .filter((id): id is string => !!id),
    )
    if (shapeIds.size !== 1) return null
    const shapeId = [...shapeIds][0]
    const shapeElements = sceneElements.filter(
      el => !el.isDeleted && (el as unknown as { customData?: { threeDShape?: ThreeDShapeMeta } }).customData?.threeDShape?.shapeId === shapeId,
    )
    // Only show the inspector once every edge of the shape is selected —
    // matches Excalidraw's own group-selection behavior.
    if (!shapeElements.every(el => ids.includes(el.id))) return null

    const meta = (shapeElements[0] as unknown as { customData: { threeDShape: ThreeDShapeMeta } }).customData.threeDShape
    const xs: number[] = []
    const ys: number[] = []
    for (const el of shapeElements) {
      const points = (el as unknown as { points?: [number, number][] }).points ?? [[0, 0]]
      for (const [px, py] of points) {
        xs.push(el.x + px)
        ys.push(el.y + py)
      }
    }
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return {
      kind: 'shape',
      elementIds: shapeElements.map(el => el.id),
      label: meta.label ?? PRIMITIVE_LABELS[meta.primitive],
      bbox: { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY },
    }
  }, [sceneElements, selectedElementIds])

  // Grid style is a per-viewer preference, not board content — kept local,
  // never broadcast to other participants.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GRID_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.cellSize === 'number' && GRID_STYLES.has(parsed.style)) {
        setGridSettings({ style: parsed.style, cellSize: parsed.cellSize })
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(gridSettings))
    } catch {}
  }, [gridSettings])

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
    (elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles) => {
      setSceneElements(elements)
      setSelectedElementIds(state.selectedElementIds)
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

  const handleInsertFormula = useCallback(async (latex: string, dataUrl: string, width: number, height: number, color: string) => {
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

    // Editing an existing formula keeps it centered on the same spot instead
    // of jumping to the viewport center; a fresh insert centers on-screen.
    let x: number
    let y: number
    if (editingFormula) {
      x = editingFormula.x + editingFormula.width / 2 - width / 2
      y = editingFormula.y + editingFormula.height / 2 - height / 2
    } else {
      const { scrollX, scrollY, width: viewWidth, height: viewHeight } = apiRef.current.getAppState()
      x = -scrollX + viewWidth / 2 - width / 2
      y = -scrollY + viewHeight / 2 - height / 2
    }

    // No `link` here on purpose — Excalidraw's own hyperlink popup can't be
    // customized (its "edit" pencil rewrites the raw link text instead of
    // opening our editor), so re-opening the formula editor and renaming it
    // both go through our own ElementInspector overlay instead.
    const [imageElement] = convertToExcalidrawElements(
      [
        {
          type: 'image',
          id: editingFormula?.id,
          fileId,
          x,
          y,
          width,
          height,
          customData: { formulaLatex: latex, formulaColor: color, label: editingFormula?.label },
        },
      ],
      { regenerateIds: false },
    )

    const current = apiRef.current.getSceneElements()
    const nextElements = editingFormula
      ? current.map(el => (el.id === editingFormula.id ? imageElement : el))
      : [...current, imageElement]

    apiRef.current.updateScene({ elements: nextElements })
    setActivePopover(null)
    setEditingFormula(null)
  }, [editingFormula])

  const handleInsertShape = useCallback(async (payload: ThreeDInsertPayload) => {
    if (!apiRef.current) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    const { boundsOfEdges } = await import('./shapeGeometry')

    const shapeId = editingShape?.meta.shapeId ?? crypto.randomUUID()
    const bounds = boundsOfEdges(payload.edges)

    let originX: number
    let originY: number
    if (editingShape) {
      originX = editingShape.bbox.x + editingShape.bbox.width / 2 - bounds.width / 2
      originY = editingShape.bbox.y + editingShape.bbox.height / 2 - bounds.height / 2
    } else {
      const { scrollX, scrollY, width: viewWidth, height: viewHeight } = apiRef.current.getAppState()
      originX = -scrollX + viewWidth / 2 - bounds.width / 2
      originY = -scrollY + viewHeight / 2 - bounds.height / 2
    }

    const meta: ThreeDShapeMeta = {
      shapeId,
      primitive: payload.primitive,
      rotationX: payload.rotationX,
      rotationY: payload.rotationY,
      scale: payload.scale,
      color: payload.color,
      label: editingShape?.meta.label,
    }

    const newEdgeElements = convertToExcalidrawElements(
      payload.edges.map(edge => ({
        type: 'line' as const,
        x: originX + (edge.x1 - bounds.minX),
        y: originY + (edge.y1 - bounds.minY),
        points: [[0, 0], [edge.x2 - edge.x1, edge.y2 - edge.y1]],
        strokeColor: payload.color,
        // Self-occluded edges (per the convex-solid classification in
        // ThreeDPanel) are baked in as dashed at the shape's current
        // rotation — same convention as technical/CAD hidden-line drawings.
        strokeStyle: edge.dashed ? 'dashed' as const : 'solid' as const,
        groupIds: [shapeId],
        customData: { threeDShape: meta },
      })),
      { regenerateIds: true },
    )

    const current = apiRef.current.getSceneElements()
    const nextElements = editingShape
      ? [...current.filter(el => !editingShape.elementIds.includes(el.id)), ...newEdgeElements]
      : [...current, ...newEdgeElements]

    apiRef.current.updateScene({ elements: nextElements })
    setActivePopover(null)
    setEditingShape(null)
  }, [editingShape])

  const handleInsertLine = useCallback(async (line: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!apiRef.current) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    const [lineElement] = convertToExcalidrawElements([
      {
        type: 'line',
        x: line.x1,
        y: line.y1,
        points: [[0, 0], [line.x2 - line.x1, line.y2 - line.y1]],
      },
    ])
    apiRef.current.updateScene({ elements: [...apiRef.current.getSceneElements(), lineElement] })
  }, [])

  const handleOpenInspectorEditor = useCallback(() => {
    if (!inspectorTarget) return
    if (inspectorTarget.kind === 'formula') {
      const el = sceneElements.find(e => e.id === inspectorTarget.elementIds[0])
      const customData = (el as unknown as { customData?: { formulaLatex?: string; formulaColor?: string; label?: string } } | undefined)?.customData
      if (!el || typeof customData?.formulaLatex !== 'string') return
      setEditingShape(null)
      setEditingFormula({
        id: el.id,
        latex: customData.formulaLatex,
        color: customData.formulaColor ?? (isDark ? '#ececec' : '#1e1e1e'),
        label: customData.label,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      })
      setActivePopover('formula')
    } else {
      const first = sceneElements.find(e => e.id === inspectorTarget.elementIds[0])
      const meta = (first as unknown as { customData?: { threeDShape?: ThreeDShapeMeta } } | undefined)?.customData?.threeDShape
      if (!meta) return
      setEditingFormula(null)
      setEditingShape({ elementIds: inspectorTarget.elementIds, meta, bbox: inspectorTarget.bbox })
      setActivePopover('3d')
    }
  }, [inspectorTarget, sceneElements, isDark])

  const handleRenameInspectorTarget = useCallback(async (newLabel: string) => {
    if (!inspectorTarget || !apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const idSet = new Set(inspectorTarget.elementIds)
    for (const el of apiRef.current.getSceneElements()) {
      if (!idSet.has(el.id)) continue
      const customData = (el as unknown as { customData?: Record<string, unknown> }).customData ?? {}
      mutateElement(el, { customData: { ...customData, label: newLabel } })
    }
  }, [inspectorTarget])

  return (
    <div className={styles.root}>
      <div className={styles.canvas}>
        {/* Sits behind Excalidraw's own (now transparent) canvas — Excalidraw
            paints background + elements onto one <canvas>, so nothing can be
            slotted between them; this layer supplies the notebook-style grid
            instead. It's a per-viewer preference (localStorage), never part
            of the synced board content. */}
        <div
          className={styles.gridLayer}
          data-grid-style={gridSettings.style}
          style={{
            '--grid-size': `${gridSettings.cellSize * viewTransform.zoom.value}px`,
            '--grid-offset-x': `${viewTransform.scrollX * viewTransform.zoom.value}px`,
            '--grid-offset-y': `${viewTransform.scrollY * viewTransform.zoom.value}px`,
          } as React.CSSProperties}
        />
        <Excalidraw
          excalidrawAPI={api => {
            apiRef.current = api
            setReady(true)
            const appState = api.getAppState()
            setViewTransform({ scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom, offsetLeft: appState.offsetLeft, offsetTop: appState.offsetTop })
          }}
          onChange={handleChange}
          onScrollChange={(scrollX, scrollY, zoom) => {
            const appState = apiRef.current?.getAppState()
            setViewTransform({ scrollX, scrollY, zoom, offsetLeft: appState?.offsetLeft ?? 0, offsetTop: appState?.offsetTop ?? 0 })
          }}
          initialData={{ appState: { viewBackgroundColor: 'transparent' } }}
          theme={isDark ? 'dark' : 'light'}
          viewModeEnabled={false}
          isCollaborating={false}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              toggleTheme: false,
              changeViewBackgroundColor: false,
            },
          }}
        />
        <ShapeInteractionLayer
          elements={sceneElements}
          viewTransform={viewTransform}
          constructionMode={constructionMode}
          onInsertLine={handleInsertLine}
        />
        {inspectorTarget && (
          <ElementInspector
            label={inspectorTarget.label}
            x={(inspectorTarget.bbox.x + viewTransform.scrollX) * viewTransform.zoom.value}
            y={(inspectorTarget.bbox.y + viewTransform.scrollY) * viewTransform.zoom.value - 8}
            onEdit={handleOpenInspectorEditor}
            onRename={handleRenameInspectorTarget}
          />
        )}
        {/* Excalidraw has no public slot for adding a button into its own
            left-side toolbar Island, and the top-right slot (renderTopRightUI)
            collides with the call's video preview tile — so this floats on
            top of the canvas, below the native toolbar, on the left. */}
        <div className={styles.formulaWrap}>
          <div className={styles.formulaButtonsRow}>
            <button
              type="button"
              className={`${styles.formulaButton} ${activePopover === 'formula' ? styles.formulaButtonActive : ''}`}
              onClick={() => {
                setEditingFormula(null)
                setEditingShape(null)
                setAutoOpenAi(false)
                setActivePopover(v => (v === 'formula' ? null : 'formula'))
              }}
              title="Формула"
            >
              ∑ Формула
            </button>
            <button
              type="button"
              className={styles.aiMiniButton}
              onClick={() => {
                setEditingFormula(null)
                setEditingShape(null)
                setAutoOpenAi(true)
                setActivePopover('formula')
              }}
              title="Создать формулу с ИИ"
            >
              ✨ ИИ
            </button>
            <button
              type="button"
              className={`${styles.formulaButton} ${activePopover === 'grid' ? styles.formulaButtonActive : ''}`}
              onClick={() => setActivePopover(v => (v === 'grid' ? null : 'grid'))}
              title="Сетка"
            >
              ▦ Сетка
            </button>
            <button
              type="button"
              className={`${styles.formulaButton} ${activePopover === '3d' ? styles.formulaButtonActive : ''}`}
              onClick={() => {
                setEditingShape(null)
                setActivePopover(v => (v === '3d' ? null : '3d'))
              }}
              title="Фигуры"
            >
              △ Фигуры
            </button>
            <button
              type="button"
              className={`${styles.formulaButton} ${constructionMode ? styles.formulaButtonActive : ''}`}
              onClick={() => setConstructionMode(v => !v)}
              title="Построения: линии со снапом к вершинам/центру фигур"
            >
              📐 Построения
            </button>
          </div>
          {activePopover === 'formula' && (
            <div className={styles.formulaPopover}>
              <FormulaKeyboard
                initialLatex={editingFormula?.latex}
                initialColor={editingFormula?.color}
                onInsert={handleInsertFormula}
                onClose={() => {
                  setActivePopover(null)
                  setEditingFormula(null)
                  setAutoOpenAi(false)
                }}
                roomName={roomName}
                isVip={isVip}
                isAdmin={isAdmin}
                autoOpenAi={autoOpenAi}
              />
            </div>
          )}
          {activePopover === 'grid' && (
            <div className={styles.formulaPopover}>
              <GridSettingsPanel
                settings={gridSettings}
                onChange={setGridSettings}
                onClose={() => setActivePopover(null)}
              />
            </div>
          )}
          {activePopover === '3d' && (
            <div className={styles.formulaPopover}>
              <ThreeDPanel
                initial={editingShape?.meta}
                onInsert={handleInsertShape}
                onClose={() => {
                  setActivePopover(null)
                  setEditingShape(null)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
