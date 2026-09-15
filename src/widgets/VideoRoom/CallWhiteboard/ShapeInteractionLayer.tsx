'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Zoom } from '@excalidraw/excalidraw/types'
import { findNearestSnapPoint, getAllZones, type Point, type SnapCandidate, type SnapRef } from './shapeGeometry'
import { computeZoneSnapCandidates } from './threeDRender'
import styles from './ShapeInteractionLayer.module.scss'

export interface ViewTransform {
  scrollX: number
  scrollY: number
  zoom: Zoom
  offsetLeft: number
  offsetTop: number
}

export interface LineBinding {
  zoneElementId: string
  ref: SnapRef
}

interface Props {
  elements: readonly ExcalidrawElement[]
  viewTransform: ViewTransform
  constructionMode: boolean
  onInsertLine: (line: { x1: number; y1: number; x2: number; y2: number; startBinding: LineBinding | null; endBinding: LineBinding | null }) => void
  /** Both ends snapped inside the SAME shape — rendered inside that zone's
   * own three.js scene instead of as a separate Excalidraw element. */
  onInsertZoneLine: (zoneElementId: string, startRef: SnapRef, endRef: SnapRef) => void
}

const SNAP_PX = 16

interface DrawState {
  start: Point
  startSnap: SnapCandidate | null
  current: Point
  snapped: SnapCandidate | null
}

export function ShapeInteractionLayer({ elements, viewTransform, constructionMode, onInsertLine, onInsertZoneLine }: Props) {
  const [drawState, setDrawState] = useState<DrawState | null>(null)

  const toScene = useCallback((clientX: number, clientY: number): Point =>
    viewportCoordsToSceneCoords({ clientX, clientY }, viewTransform),
  [viewTransform])

  const toScreen = useCallback((p: Point): Point => {
    const { x, y } = sceneCoordsToViewportCoords({ sceneX: p.x, sceneY: p.y }, viewTransform)
    return { x: x - viewTransform.offsetLeft, y: y - viewTransform.offsetTop }
  }, [viewTransform])

  // Only recomputed when the scene actually changes (insert/edit/rotate
  // commit) — each zone rebuilds its geometry/topology once here, cheap
  // enough off the per-frame path.
  const snapPoints = useMemo(() => {
    const candidates: SnapCandidate[] = []
    for (const { element, zone, rect } of getAllZones(elements)) {
      candidates.push(...computeZoneSnapCandidates(element.id, zone, rect))
    }
    return candidates
  }, [elements])
  const zoomValue = viewTransform.zoom.value

  const handleCaptureDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const point = toScene(e.clientX, e.clientY)
    const snap = findNearestSnapPoint(point, snapPoints, SNAP_PX, zoomValue)
    setDrawState({ start: snap ?? point, startSnap: snap, current: snap ?? point, snapped: snap })
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
    // Side effect (onInsertLine) lives outside the setState call on purpose —
    // React 18 dev StrictMode double-invokes setState *updater functions* to
    // catch impurity, so a `setDrawState(prev => { onInsertLine(...); ... })`
    // form was firing the insert twice per single drag.
    if (drawState) {
      const end = drawState.snapped ?? drawState.current
      if (Math.hypot(end.x - drawState.start.x, end.y - drawState.start.y) > 2) {
        const sameZone = drawState.startSnap && drawState.snapped && drawState.startSnap.zoneElementId === drawState.snapped.zoneElementId
        if (sameZone && drawState.startSnap && drawState.snapped) {
          onInsertZoneLine(drawState.startSnap.zoneElementId, drawState.startSnap.ref, drawState.snapped.ref)
        } else {
          onInsertLine({
            x1: drawState.start.x,
            y1: drawState.start.y,
            x2: end.x,
            y2: end.y,
            startBinding: drawState.startSnap ? { zoneElementId: drawState.startSnap.zoneElementId, ref: drawState.startSnap.ref } : null,
            endBinding: drawState.snapped ? { zoneElementId: drawState.snapped.zoneElementId, ref: drawState.snapped.ref } : null,
          })
        }
      }
    }
    setDrawState(null)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }, [drawState, onInsertLine, onInsertZoneLine])

  const drawScreen = drawState && {
    a: toScreen(drawState.start),
    b: toScreen(drawState.current),
  }

  if (!constructionMode) return null

  return (
    <div className={styles.layer} data-capture>
      <div
        className={styles.capture}
        onPointerDown={handleCaptureDown}
        onPointerMove={handleCaptureMove}
        onPointerUp={handleCaptureUp}
      />
      <svg className={styles.svg}>
        {drawScreen && (
          <>
            <line x1={drawScreen.a.x} y1={drawScreen.a.y} x2={drawScreen.b.x} y2={drawScreen.b.y} className={styles.previewLine} />
            {drawState?.startSnap && <circle cx={drawScreen.a.x} cy={drawScreen.a.y} r={5} className={styles.snapDot} />}
            {drawState?.snapped && <circle cx={drawScreen.b.x} cy={drawScreen.b.y} r={5} className={styles.snapDot} />}
          </>
        )}
      </svg>
    </div>
  )
}
