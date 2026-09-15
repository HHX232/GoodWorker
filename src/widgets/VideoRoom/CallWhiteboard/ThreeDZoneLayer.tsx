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
  onRotationCommit: (zoneElementId: string, rotationX: number, rotationY: number, rotationZ: number) => void
  onEdgeColorChange: (zoneElementId: string, edgeIndex: number, color: string) => void
  onEdgeLabelChange: (zoneElementId: string, edgeIndex: number, text: string) => void
  onVertexColorChange: (zoneElementId: string, vertexIndex: number, color: string) => void
  onVertexLabelChange: (zoneElementId: string, vertexIndex: number, text: string) => void
  onVertexMarkDelete: (zoneElementId: string, vertexIndex: number) => void
  onLineColorChange: (zoneElementId: string, lineId: string, color: string) => void
  onLineDelete: (zoneElementId: string, lineId: string) => void
  onSelectZone: (zoneElementId: string) => void
  onMoveZoneTo: (zoneElementId: string, x: number, y: number) => void
  onResizeZoneTo: (zoneElementId: string, width: number, height: number) => void
}

export function ThreeDZoneLayer({ elements, viewTransform, interactive, onRotationCommit, onEdgeColorChange, onEdgeLabelChange, onVertexColorChange, onVertexLabelChange, onVertexMarkDelete, onLineColorChange, onLineDelete, onSelectZone, onMoveZoneTo, onResizeZoneTo }: Props) {
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
          onRotationCommit={(x, y, z) => onRotationCommit(element.id, x, y, z)}
          onEdgeColorChange={(edgeIndex, color) => onEdgeColorChange(element.id, edgeIndex, color)}
          onEdgeLabelChange={(edgeIndex, text) => onEdgeLabelChange(element.id, edgeIndex, text)}
          onVertexColorChange={(vertexIndex, color) => onVertexColorChange(element.id, vertexIndex, color)}
          onVertexLabelChange={(vertexIndex, text) => onVertexLabelChange(element.id, vertexIndex, text)}
          onVertexMarkDelete={vertexIndex => onVertexMarkDelete(element.id, vertexIndex)}
          onLineColorChange={(lineId, color) => onLineColorChange(element.id, lineId, color)}
          onLineDelete={lineId => onLineDelete(element.id, lineId)}
          onSelect={() => onSelectZone(element.id)}
          onMoveTo={(x, y) => onMoveZoneTo(element.id, x, y)}
          onResizeTo={(w, h) => onResizeZoneTo(element.id, w, h)}
        />
      ))}
    </div>
  )
}
