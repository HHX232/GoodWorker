'use client'

import React, { useMemo } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Zoom } from '@excalidraw/excalidraw/types'
import { getAllZones } from './shapeGeometry'
import { ThreeDZoneCanvas } from './ThreeDZoneCanvas'
import styles from './ThreeDZoneLayer.module.scss'

export interface ViewTransform {
  scrollX: number
  scrollY: number
  zoom: Zoom
}

interface Props {
  elements: readonly ExcalidrawElement[]
  viewTransform: ViewTransform
  /** False while a drawing tool (not selection/hand) is active — zones stop
   * grabbing drags so that tool can be used directly over the shape. */
  interactive: boolean
  /** "∠ Угол" tool active — see ThreeDZoneCanvas's angleMode prop. */
  angleMode: boolean
  onRotationCommit: (zoneElementId: string, rotationX: number, rotationY: number, rotationZ: number) => void
  onEdgeColorChange: (zoneElementId: string, edgeIndex: number, color: string) => void
  onEdgeLabelChange: (zoneElementId: string, edgeIndex: number, text: string) => void
  onVertexMarkUpsert: (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number, color: string) => void
  onVertexMarkLabelChange: (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number, text: string) => void
  onVertexMarkDelete: (zoneElementId: string, faceIndex: number, edgeIndexA: number, edgeIndexB: number) => void
  onLineColorChange: (zoneElementId: string, lineId: string, color: string) => void
  onLineLabelChange: (zoneElementId: string, lineId: string, text: string) => void
  onLineDelete: (zoneElementId: string, lineId: string) => void
  onSelectZone: (zoneElementId: string) => void
  onMoveZoneTo: (zoneElementId: string, x: number, y: number) => void
  onResizeZoneTo: (zoneElementId: string, width: number, height: number) => void
}

export function ThreeDZoneLayer({ elements, viewTransform, interactive, angleMode, onRotationCommit, onEdgeColorChange, onEdgeLabelChange, onVertexMarkUpsert, onVertexMarkLabelChange, onVertexMarkDelete, onLineColorChange, onLineLabelChange, onLineDelete, onSelectZone, onMoveZoneTo, onResizeZoneTo }: Props) {
  const zones = useMemo(() => getAllZones(elements), [elements])
  const flatViewTransform = { scrollX: viewTransform.scrollX, scrollY: viewTransform.scrollY, zoom: viewTransform.zoom.value }

  return (
    <div className={styles.layer}>
      {zones.map(({ element, zone, rect }) => (
        <ThreeDZoneCanvas
          key={element.id}
          rect={rect}
          zone={zone}
          viewTransform={flatViewTransform}
          interactive={interactive}
          angleMode={angleMode}
          onRotationCommit={(x, y, z) => onRotationCommit(element.id, x, y, z)}
          onEdgeColorChange={(edgeIndex, color) => onEdgeColorChange(element.id, edgeIndex, color)}
          onEdgeLabelChange={(edgeIndex, text) => onEdgeLabelChange(element.id, edgeIndex, text)}
          onVertexMarkUpsert={(faceIndex, edgeIndexA, edgeIndexB, color) => onVertexMarkUpsert(element.id, faceIndex, edgeIndexA, edgeIndexB, color)}
          onVertexMarkLabelChange={(faceIndex, edgeIndexA, edgeIndexB, text) => onVertexMarkLabelChange(element.id, faceIndex, edgeIndexA, edgeIndexB, text)}
          onVertexMarkDelete={(faceIndex, edgeIndexA, edgeIndexB) => onVertexMarkDelete(element.id, faceIndex, edgeIndexA, edgeIndexB)}
          onLineColorChange={(lineId, color) => onLineColorChange(element.id, lineId, color)}
          onLineLabelChange={(lineId, text) => onLineLabelChange(element.id, lineId, text)}
          onLineDelete={lineId => onLineDelete(element.id, lineId)}
          onSelect={() => onSelectZone(element.id)}
          onMoveTo={(x, y) => onMoveZoneTo(element.id, x, y)}
          onResizeTo={(w, h) => onResizeZoneTo(element.id, w, h)}
        />
      ))}
    </div>
  )
}
