'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Zoom } from '@excalidraw/excalidraw/types'
import { findNearestEdgePoint, findNearestLinePoint, findNearestSnapPoint, getAllZones, type EdgeSegmentCandidate, type LineSegmentCandidate, type Point, type SnapCandidate, type SnapRef } from './shapeGeometry'
import { computeZoneEdgeSegments, computeZoneLineSegments, computeZoneSnapCandidates } from './threeDRender'
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

// Vertices/midpoints/face-centers/centroid are "magnetic": a bigger capture
// radius pulls the cursor onto them, and an even bigger release radius keeps
// it locked there for a bit as the cursor moves away (the "задерживалась"
// feel) instead of letting go the instant it's no longer the closest point.
// Landing anywhere else on an edge still snaps continuously to the edge
// itself (EDGE_SNAP_PX), tighter than the magnet radius so a point near a
// vertex prefers the vertex over sliding.
const MAGNET_CAPTURE_PX = 16
const MAGNET_RELEASE_PX = 26
const EDGE_SNAP_PX = 13

interface DrawState {
  start: Point
  startSnap: SnapCandidate | null
  current: Point
  snapped: SnapCandidate | null
}

/** Resolves the live draw-cursor position against magnet points, the
 * nearest shape edge, and the nearest EXISTING construction line (so one
 * construction can be built starting/ending on another, not just on the
 * shape itself) — with hysteresis via `prevSnap` — and picks whichever
 * candidate is actually closest to the cursor, rather than letting a magnet
 * within its (larger) capture radius always win even when an edge or line
 * sits right under the cursor and a vertex/midpoint is only incidentally
 * nearby. Falls back to a free unbound point if nothing is in range. */
function resolveDrawPoint(point: Point, prevSnap: SnapCandidate | null, snapPoints: SnapCandidate[], edgeSegments: EdgeSegmentCandidate[], lineSegments: LineSegmentCandidate[], zoom: number): SnapCandidate | null {
  if (prevSnap && prevSnap.ref.kind !== 'edgePoint' && prevSnap.ref.kind !== 'linePoint') {
    const stillNear = Math.hypot(point.x - prevSnap.x, point.y - prevSnap.y) * zoom <= MAGNET_RELEASE_PX
    if (stillNear) return prevSnap
  }
  const magnet = findNearestSnapPoint(point, snapPoints, MAGNET_CAPTURE_PX, zoom)
  const edgeSlide = findNearestEdgePoint(point, edgeSegments, EDGE_SNAP_PX, zoom)
  const lineSlide = findNearestLinePoint(point, lineSegments, EDGE_SNAP_PX, zoom)
  const candidates = [magnet, edgeSlide, lineSlide].filter((c): c is SnapCandidate => c !== null)
  if (candidates.length === 0) return null
  return candidates.reduce((best, c) => (
    Math.hypot(point.x - c.x, point.y - c.y) < Math.hypot(point.x - best.x, point.y - best.y) ? c : best
  ))
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
  const edgeSegments = useMemo(() => {
    const segments: EdgeSegmentCandidate[] = []
    for (const { element, zone, rect } of getAllZones(elements)) {
      segments.push(...computeZoneEdgeSegments(element.id, zone, rect))
    }
    return segments
  }, [elements])
  const lineSegments = useMemo(() => {
    const segments: LineSegmentCandidate[] = []
    for (const { element, zone, rect } of getAllZones(elements)) {
      segments.push(...computeZoneLineSegments(element.id, zone, rect))
    }
    return segments
  }, [elements])
  const zoomValue = viewTransform.zoom.value

  const handleCaptureDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const point = toScene(e.clientX, e.clientY)
    const snap = resolveDrawPoint(point, null, snapPoints, edgeSegments, lineSegments, zoomValue)
    setDrawState({ start: snap ?? point, startSnap: snap, current: snap ?? point, snapped: snap })
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [toScene, snapPoints, edgeSegments, lineSegments, zoomValue])

  const handleCaptureMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDrawState(prev => {
      if (!prev) return prev
      const point = toScene(e.clientX, e.clientY)
      const snap = resolveDrawPoint(point, prev.snapped, snapPoints, edgeSegments, lineSegments, zoomValue)
      return { ...prev, current: snap ?? point, snapped: snap }
    })
  }, [toScene, snapPoints, edgeSegments, lineSegments, zoomValue])

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
