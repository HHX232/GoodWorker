'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFileData, BinaryFiles, DataURL, ExcalidrawImperativeAPI, Zoom } from '@excalidraw/excalidraw/types'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { GridSettingsPanel, DEFAULT_GRID_SETTINGS, type GridSettings } from './GridSettingsPanel'
import { ElementInspector } from './ElementInspector'
import { getZoneRect, readThreeDZone, type SnapRef, type ThreeDShapeMeta, type ThreeDZone, type ZoneRect, type ZoneSelection } from './shapeGeometry'
import type { LineBinding, ViewTransform } from './ShapeInteractionLayer'
import styles from './CallWhiteboard.module.scss'

// A named component (not an inline arrow function) so useTranslations works
// inside it the same as any other rendered component — next/dynamic's
// `loading` callback still gets mounted through the normal React tree.
function ExcalidrawLoading() {
  const t = useTranslations('whiteboard')
  return <div className={styles.loading}>{t('loadingBoard')}</div>
}

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
  { ssr: false, loading: () => <ExcalidrawLoading /> },
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

const TemplatesModal = dynamic(
  () => import('./TemplatesModal').then(m => ({ default: m.TemplatesModal })),
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

// Identity for a vertex mark is the (faceIndex, edgeIndexA, edgeIndexB)
// triple, not its `id` — a freshly-created mark can be addressed this way
// before its mutateElement round-trip lands, and matching is order-
// independent since the two edges could resolve either way.
function findVertexMarkIndex(marks: ThreeDZone['vertexMarks'], faceIndex: number, edgeIndexA: number, edgeIndexB: number): number {
  return (marks ?? []).findIndex(m => m.faceIndex === faceIndex
    && ((m.edgeIndexA === edgeIndexA && m.edgeIndexB === edgeIndexB) || (m.edgeIndexA === edgeIndexB && m.edgeIndexB === edgeIndexA)))
}

async function postTemplateSnapshot(name: string, elements: readonly ExcalidrawElement[]): Promise<boolean> {
  const nonDeleted = elements.filter(el => !el.isDeleted)
  if (nonDeleted.length === 0) return false
  try {
    const res = await fetch('/api/whiteboard/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, snapshot: nonDeleted }),
    })
    return res.ok
  } catch (err) {
    console.error('[CallWhiteboard] save template failed:', err)
    return false
  }
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
  const formulaWrapRef = useRef<HTMLDivElement>(null)
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
  const [angleMode, setAngleMode] = useState(false)
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [sceneElements, setSceneElements] = useState<readonly ExcalidrawElement[]>([])
  const [selectedElementIds, setSelectedElementIds] = useState<Record<string, boolean>>({})
  // Selection/hand tool → zones keep grabbing drags for rotate/edge-pick.
  // Any drawing tool → zones let clicks through so it can draw over the shape.
  const [activeToolType, setActiveToolType] = useState<AppState['activeTool']['type']>('selection')
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false)
  const [creatingTemplateName, setCreatingTemplateName] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  // Mirrors creatingTemplateName/sceneElements for the unmount-time auto-save
  // effect below, which can't rely on stale closures over state.
  const creatingTemplateRef = useRef<string | null>(null)
  const sceneElementsRef = useRef<readonly ExcalidrawElement[]>([])
  const { isDark } = useThemeCtx()
  const t = useTranslations('whiteboard')

  // The popover (formula/grid/shape panels) used to be positioned via plain
  // CSS relative to the toolbar row, inside two ancestors that both clip
  // overflow (.root and the call page's own .tile) — a tall panel like the
  // shape picker got cut off, or ended up hidden behind the call's bottom
  // controlbar, with no amount of z-index able to fix it since overflow
  // clipping isn't a stacking question. Measuring the toolbar's real screen
  // position and rendering the popover `position: fixed` (in CallWhiteboard
  // .module.scss) escapes both ancestors entirely, same technique already
  // used for the in-canvas edge/line color popovers.
  useLayoutEffect(() => {
    if (!activePopover) return
    const measure = () => {
      const rect = formulaWrapRef.current?.getBoundingClientRect()
      if (rect) setPopoverPos({ top: rect.bottom + 6, left: rect.left })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activePopover])

  const inspectorTarget = useMemo<InspectorTarget | null>(() => {
    const ids = Object.keys(selectedElementIds).filter(id => selectedElementIds[id])
    if (ids.length !== 1) return null
    const el = sceneElements.find(e => e.id === ids[0] && !e.isDeleted)
    if (!el) return null

    if (el.type === 'image') {
      const customData = (el as unknown as { customData?: { formulaLatex?: string; label?: string } }).customData
      if (typeof customData?.formulaLatex !== 'string') return null
      return { kind: 'formula', elementId: el.id, label: customData.label ?? t('formulaLabel'), x: el.x, y: el.y, width: el.width, height: el.height }
    }

    if (el.type === 'rectangle') {
      const zone = readThreeDZone(el)
      if (!zone) return null
      return { kind: 'shape', elementId: el.id, label: zone.label ?? t(`shapes.${zone.primitive}`), x: el.x, y: el.y, width: el.width, height: el.height }
    }

    return null
  }, [sceneElements, selectedElementIds, t])

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
        const transparency = typeof parsed.transparency === 'number' ? parsed.transparency : DEFAULT_GRID_SETTINGS.transparency
        setGridSettings({ style: parsed.style, cellSize: parsed.cellSize, transparency })
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(gridSettings))
    } catch {}
  }, [gridSettings])

  // Apply remote elements when they arrive. Also cancels any broadcast
  // already scheduled by handleChange — on a fresh mount (e.g. after the
  // call UI minimizes/restores the whiteboard, destroying and recreating
  // this component), Excalidraw's own first onChange fires with an EMPTY
  // scene before this effect gets to run, scheduling a 400ms broadcast of
  // that empty state. Normally that gets cleared by the next onChange, but
  // the one this effect's own updateScene triggers returns early (via
  // isApplyingRemoteRef) before it reaches its clearTimeout — so without
  // this, the stale empty-scene broadcast fires ~400ms later regardless,
  // wiping the board for every participant even though it was just
  // correctly restored.
  useEffect(() => {
    if (!remoteElements || !apiRef.current || !ready) return
    const remoteMap = new Map(remoteElements.map(e => [e.id, e]))
    const current = apiRef.current.getSceneElements()
    const merged = remoteElements.slice()
    for (const el of current) {
      if (!remoteMap.has(el.id)) merged.push(el)
    }
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current)
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
      sceneElementsRef.current = elements
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

  // Setting a color is also how a mark gets created — clicking a bare
  // corner in angle mode calls this with the zone's own color before
  // showing the recolor popover, so "mark a corner" and "recolor an
  // existing mark" are the same code path.
  const handleZoneVertexMarkUpsert = useCallback(async (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number, color: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const marks = [...(existing.vertexMarks ?? [])]
    const idx = findVertexMarkIndex(marks, faceIndex, edgeIndexA, edgeIndexB)
    if (idx === -1) marks.push({ id: crypto.randomUUID(), faceIndex, edgeIndexA, edgeIndexB, color })
    else marks[idx] = { ...marks[idx], color }
    const zone: ThreeDZone = { ...existing, vertexMarks: marks }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneVertexMarkLabelChange = useCallback(async (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number, text: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const marks = [...(existing.vertexMarks ?? [])]
    const idx = findVertexMarkIndex(marks, faceIndex, edgeIndexA, edgeIndexB)
    if (idx === -1) marks.push({ id: crypto.randomUUID(), faceIndex, edgeIndexA, edgeIndexB, color: existing.color, label: text || undefined })
    else marks[idx] = { ...marks[idx], label: text || undefined }
    const zone: ThreeDZone = { ...existing, vertexMarks: marks }
    mutateElement(el, { customData: { threeDZone: zone } })
  }, [])

  const handleZoneVertexMarkDelete = useCallback(async (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const idx = findVertexMarkIndex(existing.vertexMarks, faceIndex, edgeIndexA, edgeIndexB)
    if (idx === -1) return
    const marks = [...(existing.vertexMarks ?? [])]
    marks.splice(idx, 1)
    const zone: ThreeDZone = { ...existing, vertexMarks: marks }
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

  const handleZoneLineLabelChange = useCallback(async (zoneElementId: string, lineId: string, text: string) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    const zone: ThreeDZone = {
      ...existing,
      constructionLines: (existing.constructionLines ?? []).map(line => (line.id === lineId ? { ...line, label: text || undefined } : line)),
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

  const handleZoneSelectionChange = useCallback(async (zoneElementId: string, target: ZoneSelection | null) => {
    if (!apiRef.current) return
    const { mutateElement } = await import('@excalidraw/excalidraw')
    const el = apiRef.current.getSceneElements().find(e => e.id === zoneElementId)
    if (!el) return
    const existing = readThreeDZone(el)
    if (!existing) return
    if ((existing.selection ?? null) === target) return
    const zone: ThreeDZone = { ...existing, selection: target }
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

  const handleApplyTemplate = useCallback((templateElements: ExcalidrawElement[]) => {
    if (!apiRef.current) return
    // Mark every currently-visible element deleted (rather than just
    // omitting it) so the tombstone rides along in the next onChange/
    // broadcast — other participants' own "apply remote elements" merge
    // only drops an id it sees explicitly deleted; a smaller array with no
    // tombstones would just look like a partial update to them and they'd
    // keep their own copies of the old content.
    const tombstoned = apiRef.current.getSceneElements().map(el => ({ ...el, isDeleted: true }))
    apiRef.current.updateScene({ elements: [...tombstoned, ...templateElements] })
    apiRef.current.scrollToContent(templateElements, { fitToContent: true, animate: false })
    setTemplatesModalOpen(false)
  }, [])

  const handleStartCreateTemplate = useCallback((name: string) => {
    setCreatingTemplateName(name)
    setTemplatesModalOpen(false)
  }, [])

  const handleSaveTemplate = useCallback(async () => {
    if (!creatingTemplateName || savingTemplate) return
    setSavingTemplate(true)
    const ok = await postTemplateSnapshot(creatingTemplateName, sceneElementsRef.current)
    setSavingTemplate(false)
    if (ok) {
      toast.success(t('templateSaved'))
      setCreatingTemplateName(null)
    } else {
      toast.error(t('templateSaveFailed'))
    }
  }, [creatingTemplateName, savingTemplate, t])

  useEffect(() => {
    creatingTemplateRef.current = creatingTemplateName
  }, [creatingTemplateName])

  // Best-effort auto-save: if the user started creating a template, drew
  // something, but closed the whiteboard/call without clicking "Сохранить
  // шаблон", save it for them on unmount rather than silently losing it —
  // but only if they actually drew something (never save an empty template).
  useEffect(() => {
    return () => {
      if (creatingTemplateRef.current) {
        postTemplateSnapshot(creatingTemplateRef.current, sceneElementsRef.current)
      }
    }
  }, [])

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
            '--grid-opacity': 1 - gridSettings.transparency / 100,
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
          angleMode={angleMode}
          onRotationCommit={handleZoneRotationCommit}
          onEdgeColorChange={handleZoneEdgeColorChange}
          onEdgeLabelChange={handleZoneEdgeLabelChange}
          onVertexMarkUpsert={handleZoneVertexMarkUpsert}
          onVertexMarkLabelChange={handleZoneVertexMarkLabelChange}
          onVertexMarkDelete={handleZoneVertexMarkDelete}
          onLineColorChange={handleZoneLineColorChange}
          onLineLabelChange={handleZoneLineLabelChange}
          onLineDelete={handleZoneLineDelete}
          onSelectionChange={handleZoneSelectionChange}
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
        <div className={styles.formulaWrap} ref={formulaWrapRef}>
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
                  title={t('toolbar.formula')}
                >
                  ∑ {t('toolbar.formula')}
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
                  title={t('toolbar.createFormulaAi')}
                >
                  ✨ {t('toolbar.ai')}
                </button>
                <button
                  type="button"
                  className={`${styles.formulaButton} ${activePopover === 'grid' ? styles.formulaButtonActive : ''}`}
                  onClick={() => setActivePopover(v => (v === 'grid' ? null : 'grid'))}
                  title={t('toolbar.grid')}
                >
                  ▦ {t('toolbar.grid')}
                </button>
                <button
                  type="button"
                  className={`${styles.formulaButton} ${activePopover === '3d' ? styles.formulaButtonActive : ''}`}
                  onClick={() => {
                    setEditingShape(null)
                    setActivePopover(v => (v === '3d' ? null : '3d'))
                  }}
                  title={t('toolbar.shapes')}
                >
                  △ {t('toolbar.shapes')}
                </button>
                <button
                  type="button"
                  className={`${styles.formulaButton} ${constructionMode ? styles.formulaButtonActive : ''}`}
                  onClick={() => {
                    setAngleMode(false)
                    setConstructionMode(v => !v)
                  }}
                  title={t('toolbar.constructionsTitle')}
                >
                  📐 {t('toolbar.constructions')}
                </button>
                <button
                  type="button"
                  className={`${styles.formulaButton} ${angleMode ? styles.formulaButtonActive : ''}`}
                  onClick={() => {
                    setConstructionMode(false)
                    setAngleMode(v => !v)
                  }}
                  title={t('toolbar.angleTitle')}
                >
                  ∠ {t('toolbar.angle')}
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setToolbarCollapsed(v => !v)}
              title={toolbarCollapsed ? t('toolbar.expand') : t('toolbar.collapse')}
            >
              {toolbarCollapsed ? '▸' : '◂'}
            </button>
          </div>
          {activePopover === 'formula' && (
            <div className={styles.formulaPopover} style={popoverPos ? { top: popoverPos.top, left: popoverPos.left } : undefined}>
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
            <div className={styles.formulaPopover} style={popoverPos ? { top: popoverPos.top, left: popoverPos.left } : undefined}>
              <GridSettingsPanel
                settings={gridSettings}
                onChange={setGridSettings}
                onClose={() => setActivePopover(null)}
              />
            </div>
          )}
          {activePopover === '3d' && (
            <div className={styles.formulaPopover} style={popoverPos ? { top: popoverPos.top, left: popoverPos.left } : undefined}>
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
        {/* Right-side counterpart to .formulaWrap — same "float over the
            canvas, below Excalidraw's own toolbar" reasoning, mirrored to
            the right edge since the left side is already crowded. */}
        <div className={styles.templatesWrap}>
          <button
            type="button"
            className={styles.templatesButton}
            onClick={() => setTemplatesModalOpen(true)}
            title={t('toolbar.templatesTitle')}
          >
            {t('toolbar.templates').split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </button>
          {creatingTemplateName && (
            <button
              type="button"
              className={styles.saveTemplateButton}
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              title={t('toolbar.saveTemplateTitle')}
            >
              {savingTemplate ? '…' : `💾 ${t('toolbar.saveTemplate')}`}
            </button>
          )}
        </div>
        {templatesModalOpen && (
          <TemplatesModal
            hasContent={sceneElements.some(el => !el.isDeleted)}
            onApply={handleApplyTemplate}
            onStartCreate={handleStartCreateTemplate}
            onClose={() => setTemplatesModalOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
