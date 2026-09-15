'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFileData, BinaryFiles, DataURL, ExcalidrawImperativeAPI, Zoom } from '@excalidraw/excalidraw/types'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { GridSettingsPanel, DEFAULT_GRID_SETTINGS, type GridSettings } from './GridSettingsPanel'
import { ElementInspector } from './ElementInspector'
import { getZoneRect, PRIMITIVE_LABELS, readThreeDZone, type SnapRef, type ThreeDShapeMeta, type ThreeDZone, type ZoneRect } from './shapeGeometry'
import type { LineBinding, ViewTransform } from './ShapeInteractionLayer'
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

const ThreeDZoneLayer = dynamic(
  () => import('./ThreeDZoneLayer').then(m => ({ default: m.ThreeDZoneLayer })),
  { ssr: false },
)

const DEFAULT_ZONE_SIZE = 220
const GRID_STORAGE_KEY = 'whiteboard:gridSettings'
const GRID_STYLES = new Set(['squares', 'dots', 'lines', 'off'])
const DEFAULT_ZOOM: Zoom = { value: 1 as AppState['zoom']['value'] }

// Hoisted out of the component: a fresh object reference on every render for
// props like these can make Excalidraw's own internal effects (keyed on
// prop identity) re-fire on every unrelated re-render of this component —
// with sceneElements now always getting a fresh array (see handleChange),
// that turned into a real render loop, not just wasted work.
const EXCALIDRAW_INITIAL_DATA = { appState: { viewBackgroundColor: 'transparent' } }
const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    saveToActiveFile: false,
    loadScene: false,
    export: false as const,
    toggleTheme: false,
    changeViewBackgroundColor: false,
  },
}

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
  elementId: string
  zone: ThreeDZone
}

interface InspectorTarget {
  kind: 'formula' | 'shape'
  elementId: string
  label: string
  x: number
  y: number
  width: number
  height: number
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
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [sceneElements, setSceneElements] = useState<readonly ExcalidrawElement[]>([])
  const [selectedElementIds, setSelectedElementIds] = useState<Record<string, boolean>>({})
  // Selection/hand tool → zones keep grabbing drags for rotate/edge-pick.
  // Any drawing tool → zones let clicks through so it can draw over the shape.
  const [activeToolType, setActiveToolType] = useState<AppState['activeTool']['type']>('selection')
  const { isDark } = useThemeCtx()

  const inspectorTarget = useMemo<InspectorTarget | null>(() => {
    const ids = Object.keys(selectedElementIds).filter(id => selectedElementIds[id])
    if (ids.length !== 1) return null
    const el = sceneElements.find(e => e.id === ids[0] && !e.isDeleted)
    if (!el) return null

    if (el.type === 'image') {
      const customData = (el as unknown as { customData?: { formulaLatex?: string; label?: string } }).customData
      if (typeof customData?.formulaLatex !== 'string') return null
      return { kind: 'formula', elementId: el.id, label: customData.label ?? 'Формула', x: el.x, y: el.y, width: el.width, height: el.height }
    }

    if (el.type === 'rectangle') {
      const zone = readThreeDZone(el)
      if (!zone) return null
      return { kind: 'shape', elementId: el.id, label: zone.label ?? PRIMITIVE_LABELS[zone.primitive], x: el.x, y: el.y, width: el.width, height: el.height }
    }

    return null
  }, [sceneElements, selectedElementIds])

  const handleExcalidrawApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api
    setReady(true)
    const appState = api.getAppState()
    setViewTransform({ scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom, offsetLeft: appState.offsetLeft, offsetTop: appState.offsetTop })
    setActiveToolType(appState.activeTool.type)
  }, [])

  const handleScrollChange = useCallback((scrollX: number, scrollY: number, zoom: Zoom) => {
    const appState = apiRef.current?.getAppState()
    setViewTransform({ scrollX, scrollY, zoom, offsetLeft: appState?.offsetLeft ?? 0, offsetTop: appState?.offsetTop ?? 0 })
  }, [])

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
      // Excalidraw can hand back the same array reference across consecutive
      // onChange calls during a drag (e.g. resizing), mutating elements in
      // place for performance. React bails out of a setState that's
      // reference-equal to current state, so without a fresh reference here
      // our own mirrored state (and everything derived from it — zone
      // canvases, the inspector) would silently stop tracking mid-drag.
      setSceneElements(elements.slice())
      setSelectedElementIds(state.selectedElementIds)
      setActiveToolType(prev => (prev === state.activeTool.type ? prev : state.activeTool.type))
      // onScrollChange alone missed pure zoom changes (e.g. the zoom-%
      // control, not a scroll/pan gesture) — zone canvases kept the stale
      // zoom and drifted away from their shapes. appState here always has
      // the current scroll/zoom regardless of what triggered this onChange,
      // so mirror it on every change instead of relying on a narrower event.
      setViewTransform(prev => {
        if (
          prev.scrollX === state.scrollX && prev.scrollY === state.scrollY
          && prev.zoom.value === state.zoom.value
          && prev.offsetLeft === state.offsetLeft && prev.offsetTop === state.offsetTop
        ) return prev
        return { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom, offsetLeft: state.offsetLeft, offsetTop: state.offsetTop }
      })
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

  // Re-anchors construction lines bound to `zoneElementId` (e.g. a median
  // snapped to one of its vertices) to that zone's current snap points —
  // called after anything that can move those points: a panel edit, or a
  // rotation committed live in 3D mode. Refs only resolve when the zone's
  // primitive/segment count didn't change since the line was drawn; a stale
  // ref is left untouched rather than guessed at.
  const rebindLinesForZone = useCallback(async (zoneElementId: string, zone: ThreeDZone, rect: ZoneRect) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const { resolveSnapRef } = await import('./threeDRender')

    for (const el of apiRef.current.getSceneElements()) {
      if (el.type !== 'line' || el.isDeleted) continue
      const boundTo = (el as unknown as { customData?: { boundTo?: { start: LineBinding | null; end: LineBinding | null } } }).customData?.boundTo
      if (!boundTo) continue
      const points = el.points as unknown as [number, number][]
      if (!points || points.length < 2) continue

      let start = { x: el.x, y: el.y }
      let end = { x: el.x + points[points.length - 1][0], y: el.y + points[points.length - 1][1] }
      let changed = false
      if (boundTo.start?.zoneElementId === zoneElementId) {
        const p = resolveSnapRef(zoneElementId, zone, rect, boundTo.start.ref)
        if (p) { start = p; changed = true }
      }
      if (boundTo.end?.zoneElementId === zoneElementId) {
        const p = resolveSnapRef(zoneElementId, zone, rect, boundTo.end.ref)
        if (p) { end = p; changed = true }
      }
      if (!changed) continue

      const dx = end.x - start.x
      const dy = end.y - start.y
      mutateElement(el, { x: start.x, y: start.y, width: Math.abs(dx), height: Math.abs(dy), points: [[0, 0], [dx, dy]] })
    }
  }, [])

  const handleInsertShape = useCallback(async (config: ThreeDShapeMeta) => {
    if (!apiRef.current) return

    if (editingShape) {
      const { mutateElement } = await import('@excalidraw/excalidraw')
      const el = apiRef.current.getSceneElements().find(e => e.id === editingShape.elementId)
      if (!el) return
      const zone: ThreeDZone = { ...config, edgeColors: editingShape.zone.edgeColors }
      mutateElement(el, { customData: { threeDZone: zone } })
      await rebindLinesForZone(el.id, zone, getZoneRect(el))
    } else {
      const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
      const { scrollX, scrollY, width: viewWidth, height: viewHeight } = apiRef.current.getAppState()
      const x = -scrollX + viewWidth / 2 - DEFAULT_ZONE_SIZE / 2
      const y = -scrollY + viewHeight / 2 - DEFAULT_ZONE_SIZE / 2
      const zone: ThreeDZone = { ...config }
      const [rectElement] = convertToExcalidrawElements([
        {
          type: 'rectangle',
          x,
          y,
          width: DEFAULT_ZONE_SIZE,
          height: DEFAULT_ZONE_SIZE,
          strokeColor: '#94a3b8',
          backgroundColor: 'transparent',
          strokeStyle: 'dashed',
          roughness: 0,
          customData: { threeDZone: zone },
        },
      ])
      apiRef.current.updateScene({ elements: [...apiRef.current.getSceneElements(), rectElement] })
    }

    setActivePopover(null)
    setEditingShape(null)
  }, [editingShape, rebindLinesForZone])

  const handleInsertLine = useCallback(async (line: { x1: number; y1: number; x2: number; y2: number; startBinding: LineBinding | null; endBinding: LineBinding | null }) => {
    if (!apiRef.current) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    const dx = line.x2 - line.x1
    const dy = line.y2 - line.y1
    const [lineElement] = convertToExcalidrawElements([
      {
        type: 'line',
        x: line.x1,
        y: line.y1,
        width: Math.abs(dx),
        height: Math.abs(dy),
        points: [[0, 0], [dx, dy]],
        roughness: 0,
        ...(line.startBinding || line.endBinding
          ? { customData: { boundTo: { start: line.startBinding, end: line.endBinding } } }
          : {}),
      },
    ])
    apiRef.current.updateScene({ elements: [...apiRef.current.getSceneElements(), lineElement] })
  }, [])

  const handleZoneRotationCommit = useCallback(async (zoneElementId: string, rotationX: number, rotationY: number, rotationZ: number) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = { ...existing, rotationX, rotationY, rotationZ }
    mutateElement(el, { customData: { threeDZone: zone } })
    await rebindLinesForZone(zoneElementId, zone, getZoneRect(el))
  }, [rebindLinesForZone])

  const handleZoneEdgeColorChange = useCallback(async (zoneElementId: string, edgeIndex: number, color: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = { ...existing, edgeColors: { ...existing.edgeColors, [edgeIndex]: color } }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneEdgeLabelChange = useCallback(async (zoneElementId: string, edgeIndex: number, text: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const edgeLabels = { ...existing.edgeLabels }
    if (text) edgeLabels[edgeIndex] = text
    else delete edgeLabels[edgeIndex]
    const zone: ThreeDZone = { ...existing, edgeLabels }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  // Setting a color is also how a vertex mark gets created — the first
  // click on a bare vertex calls this with the zone's own color before
  // showing the recolor popover, so "click a corner" and "recolor an
  // existing mark" are the same code path.
  const handleZoneVertexColorChange = useCallback(async (zoneElementId: string, vertexIndex: number, color: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = { ...existing, vertexMarks: { ...existing.vertexMarks, [vertexIndex]: { ...existing.vertexMarks?.[vertexIndex], color } } }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneVertexLabelChange = useCallback(async (zoneElementId: string, vertexIndex: number, text: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const existingMark = existing.vertexMarks?.[vertexIndex]
    const zone: ThreeDZone = { ...existing, vertexMarks: { ...existing.vertexMarks, [vertexIndex]: { color: existingMark?.color ?? existing.color, label: text || undefined } } }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneVertexMarkDelete = useCallback(async (zoneElementId: string, vertexIndex: number) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const vertexMarks = { ...existing.vertexMarks }
    delete vertexMarks[vertexIndex]
    const zone: ThreeDZone = { ...existing, vertexMarks }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleInsertZoneLine = useCallback(async (zoneElementId: string, startRef: SnapRef, endRef: SnapRef) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = {
      ...existing,
      constructionLines: [
        ...(existing.constructionLines ?? []),
        { id: crypto.randomUUID(), startRef, endRef, color: existing.color },
      ],
    }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneLineColorChange = useCallback(async (zoneElementId: string, lineId: string, color: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = {
      ...existing,
      constructionLines: (existing.constructionLines ?? []).map(line => (line.id === lineId ? { ...line, color } : line)),
    }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneLineDelete = useCallback(async (zoneElementId: string, lineId: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = {
      ...existing,
      constructionLines: (existing.constructionLines ?? []).filter(line => line.id !== lineId),
    }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  // Clicking the zone's move handle (not dragging it) surfaces the rename/
  // edit inspector — the zone body itself no longer passes clicks through to
  // Excalidraw's own hit-testing, since it's now always grabbing drags to
  // rotate the shape.
  const handleSelectZone = useCallback((zoneElementId: string) => {
    apiRef.current?.updateScene({ appState: { selectedElementIds: { [zoneElementId]: true } } })
  }, [])

  const handleMoveZoneTo = useCallback(async (zoneElementId: string, x: number, y: number) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    mutateElement(el, { x, y })
  }, [])

  const handleResizeZoneTo = useCallback(async (zoneElementId: string, width: number, height: number) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    mutateElement(el, { width, height })
  }, [])

  const handleOpenInspectorEditor = useCallback(() => {
    if (!inspectorTarget) return
    if (inspectorTarget.kind === 'formula') {
      const el = sceneElements.find(e => e.id === inspectorTarget.elementId)
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
      const el = sceneElements.find(e => e.id === inspectorTarget.elementId)
      const zone = el && readThreeDZone(el)
      if (!zone) return
      setEditingFormula(null)
      setEditingShape({ elementId: inspectorTarget.elementId, zone })
      setActivePopover('3d')
    }
  }, [inspectorTarget, sceneElements, isDark])

  const handleRenameInspectorTarget = useCallback(async (newLabel: string) => {
    if (!inspectorTarget || !apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === inspectorTarget.elementId)
    if (!el) return
    if (inspectorTarget.kind === 'formula') {
      const customData = (el as unknown as { customData?: Record<string, unknown> }).customData ?? {}
      mutateElement(el, { customData: { ...customData, label: newLabel } })
    } else {
      const zone = readThreeDZone(el)
      if (!zone) return
      mutateElement(el, { customData: { threeDZone: { ...zone, label: newLabel } } })
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
          excalidrawAPI={handleExcalidrawApi}
          onChange={handleChange}
          onScrollChange={handleScrollChange}
          initialData={EXCALIDRAW_INITIAL_DATA}
          theme={isDark ? 'dark' : 'light'}
          viewModeEnabled={false}
          isCollaborating={false}
          UIOptions={EXCALIDRAW_UI_OPTIONS}
        />
        <ThreeDZoneLayer
          elements={sceneElements}
          viewTransform={viewTransform}
          interactive={activeToolType === 'selection' || activeToolType === 'hand'}
          onRotationCommit={handleZoneRotationCommit}
          onEdgeColorChange={handleZoneEdgeColorChange}
          onEdgeLabelChange={handleZoneEdgeLabelChange}
          onVertexColorChange={handleZoneVertexColorChange}
          onVertexLabelChange={handleZoneVertexLabelChange}
          onVertexMarkDelete={handleZoneVertexMarkDelete}
          onLineColorChange={handleZoneLineColorChange}
          onLineDelete={handleZoneLineDelete}
          onSelectZone={handleSelectZone}
          onMoveZoneTo={handleMoveZoneTo}
          onResizeZoneTo={handleResizeZoneTo}
        />
        <ShapeInteractionLayer
          elements={sceneElements}
          viewTransform={viewTransform}
          constructionMode={constructionMode}
          onInsertLine={handleInsertLine}
          onInsertZoneLine={handleInsertZoneLine}
        />
        {inspectorTarget && (
          <ElementInspector
            label={inspectorTarget.label}
            x={(inspectorTarget.x + viewTransform.scrollX) * viewTransform.zoom.value}
            y={(inspectorTarget.y + viewTransform.scrollY) * viewTransform.zoom.value - 8}
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
            {!toolbarCollapsed && (
              <>
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
              </>
            )}
            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setToolbarCollapsed(v => !v)}
              title={toolbarCollapsed ? 'Показать кнопки' : 'Свернуть кнопки'}
            >
              {toolbarCollapsed ? '▸' : '◂'}
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
                initial={editingShape?.zone}
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
