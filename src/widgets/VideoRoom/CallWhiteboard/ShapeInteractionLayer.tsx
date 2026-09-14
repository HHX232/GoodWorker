'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Zoom } from '@excalidraw/excalidraw/types'
import { findNearestEdge, findNearestSnapPoint, getShapeEdges, getShapeSnapPoints, type Point, type ShapeEdge } from './shapeGeometry'
import styles from './ShapeInteractionLayer.module.scss'

export interface ViewTransform {
  scrollX: number
  scrollY: number
  zoom: Zoom
  offsetLeft: number
  offsetTop: number
}

interface Props {
  elements: readonly ExcalidrawElement[]
  viewTransform: ViewTransform
  constructionMode: boolean
  onInsertLine: (line: { x1: number; y1: number; x2: number; y2: number }) => void
}

const PRESS_HIT_PX = 10
const SNAP_PX = 16

interface DrawState {
  start: Point
  startSnapped: boolean
  current: Point
  snapped: Point | null
}

export function ShapeInteractionLayer({ elements, viewTransform, constructionMode, onInsertLine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pressedEdge, setPressedEdge] = useState<ShapeEdge | null>(null)
  const [drawState, setDrawState] = useState<DrawState | null>(null)

  const toScene = useCallback((clientX: number, clientY: number): Point =>
    viewportCoordsToSceneCoords({ clientX, clientY }, viewTransform),
  [viewTransform])

  const toScreen = useCallback((p: Point): Point => {
    const { x, y } = sceneCoordsToViewportCoords({ sceneX: p.x, sceneY: p.y }, viewTransform)
    return { x: x - viewTransform.offsetLeft, y: y - viewTransform.offsetTop }
  }, [viewTransform])

  const shapeEdges = useMemo(() => getShapeEdges(elements), [elements])
  const snapPoints = useMemo(() => getShapeSnapPoints(elements), [elements])
  const zoomValue = viewTransform.zoom.value

  // Press-and-hold edge highlight — listens on the canvas wrapper (a plain
  // DOM listener, added without preventDefault/stopPropagation) so it works
  // alongside normal Excalidraw interaction, not instead of it. Only relevant
  // outside construction mode, where this layer has pointer-events:none and
  // the capture div below is unmounted.
  useEffect(() => {
    if (constructionMode) return
    const target = containerRef.current?.parentElement
    if (!target) return

    const handleUp = () => {
      setPressedEdge(null)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
    const handleDown = (e: PointerEvent) => {
      const point = toScene(e.clientX, e.clientY)
      const edge = findNearestEdge(point, shapeEdges, PRESS_HIT_PX, zoomValue)
      if (!edge) return
      setPressedEdge(edge)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleUp)
    }

    target.addEventListener('pointerdown', handleDown)
    return () => {
      target.removeEventListener('pointerdown', handleDown)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [constructionMode, toScene, shapeEdges, zoomValue])

  const handleCaptureDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const point = toScene(e.clientX, e.clientY)
    const snap = findNearestSnapPoint(point, snapPoints, SNAP_PX, zoomValue)
    setDrawState({ start: snap ?? point, startSnapped: !!snap, current: snap ?? point, snapped: snap })
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [toScene, snapPoints, zoomValue])

  const handleCaptureMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDrawState(prev => {
      if (!prev) return prev
      const point = toScene(e.clientX, e.clientY)
      const snap = findNearestSnapPoint(point, snapPoints, SNAP_PX, zoomValue)
      return { ...prev, current: snap ?? point, snapped: snap }
    })
  }, [toScene, snapPoints, zoomValue])

  const handleCaptureUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDrawState(prev => {
      if (!prev) return null
      const end = prev.snapped ?? prev.current
      if (Math.hypot(end.x - prev.start.x, end.y - prev.start.y) > 2) {
        onInsertLine({ x1: prev.start.x, y1: prev.start.y, x2: end.x, y2: end.y })
      }
      return null
    })
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }, [onInsertLine])

  const pressedScreen = pressedEdge && {
    a: toScreen({ x: pressedEdge.x1, y: pressedEdge.y1 }),
    b: toScreen({ x: pressedEdge.x2, y: pressedEdge.y2 }),
  }
  const drawScreen = drawState && {
    a: toScreen(drawState.start),
    b: toScreen(drawState.current),
  }

  return (
    <div ref={containerRef} className={styles.layer} data-capture={constructionMode || undefined}>
      {constructionMode && (
        <div
          className={styles.capture}
          onPointerDown={handleCaptureDown}
          onPointerMove={handleCaptureMove}
          onPointerUp={handleCaptureUp}
        />
      )}
      <svg className={styles.svg}>
        {pressedScreen && (
          <line x1={pressedScreen.a.x} y1={pressedScreen.a.y} x2={pressedScreen.b.x} y2={pressedScreen.b.y} className={styles.highlight} />
        )}
        {drawScreen && (
          <>
            <line x1={drawScreen.a.x} y1={drawScreen.a.y} x2={drawScreen.b.x} y2={drawScreen.b.y} className={styles.previewLine} />
            {drawState?.startSnapped && <circle cx={drawScreen.a.x} cy={drawScreen.a.y} r={5} className={styles.snapDot} />}
            {drawState?.snapped && <circle cx={drawScreen.b.x} cy={drawScreen.b.y} r={5} className={styles.snapDot} />}
          </>
        )}
      </svg>
    </div>
  )
}
