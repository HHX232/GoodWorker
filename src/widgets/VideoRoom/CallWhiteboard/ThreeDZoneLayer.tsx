'use client'

import React, { useMemo } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Zoom } from '@excalidraw/excalidraw/types'
import { getAllZones, type AngleArm, type ZoneSelection } from './shapeGeometry'
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
  onVertexMarkUpsert: (zoneElementId: string, armA: AngleArm, armB: AngleArm, color: string) => void
  onVertexMarkLabelChange: (zoneElementId: string, armA: AngleArm, armB: AngleArm, text: string) => void
  onVertexMarkDelete: (zoneElementId: string, armA: AngleArm, armB: AngleArm) => void
  onLineColorChange: (zoneElementId: string, lineId: string, color: string) => void
  onLineLabelChange: (zoneElementId: string, lineId: string, text: string) => void
  onLineDelete: (zoneElementId: string, lineId: string) => void
  onSelectionChange: (zoneElementId: string, target: ZoneSelection | null) => void
  onSelectZone: (zoneElementId: string) => void
  onMoveZoneTo: (zoneElementId: string, x: number, y: number) => void
  onResizeZoneTo: (zoneElementId: string, width: number, height: number) => void
}

export function ThreeDZoneLayer({ elements, viewTransform, interactive, angleMode, onRotationCommit, onEdgeColorChange, onEdgeLabelChange, onVertexMarkUpsert, onVertexMarkLabelChange, onVertexMarkDelete, onLineColorChange, onLineLabelChange, onLineDelete, onSelectionChange, onSelectZone, onMoveZoneTo, onResizeZoneTo }: Props) {
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
          onVertexMarkUpsert={(armA, armB, color) => onVertexMarkUpsert(element.id, armA, armB, color)}
          onVertexMarkLabelChange={(armA, armB, text) => onVertexMarkLabelChange(element.id, armA, armB, text)}
          onVertexMarkDelete={(armA, armB) => onVertexMarkDelete(element.id, armA, armB)}
          onLineColorChange={(lineId, color) => onLineColorChange(element.id, lineId, color)}
          onLineLabelChange={(lineId, text) => onLineLabelChange(element.id, lineId, text)}
          onLineDelete={lineId => onLineDelete(element.id, lineId)}
          onSelectionChange={target => onSelectionChange(element.id, target)}
          onSelect={() => onSelectZone(element.id)}
          onMoveTo={(x, y) => onMoveZoneTo(element.id, x, y)}
          onResizeTo={(w, h) => onResizeZoneTo(element.id, w, h)}
        />
      ))}
    </div>
  )
}
