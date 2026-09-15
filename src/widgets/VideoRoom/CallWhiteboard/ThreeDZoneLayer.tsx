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
  onRotationCommit: (zoneElementId: string, rotationX: number, rotationY: number, rotationZ: number) => void
  onEdgeColorChange: (zoneElementId: string, edgeIndex: number, color: string) => void
  onSelectZone: (zoneElementId: string) => void
  onMoveZoneTo: (zoneElementId: string, x: number, y: number) => void
  onResizeZoneTo: (zoneElementId: string, width: number, height: number) => void
}

export function ThreeDZoneLayer({ elements, viewTransform, onRotationCommit, onEdgeColorChange, onSelectZone, onMoveZoneTo, onResizeZoneTo }: Props) {
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
          onRotationCommit={(x, y, z) => onRotationCommit(element.id, x, y, z)}
          onEdgeColorChange={(edgeIndex, color) => onEdgeColorChange(element.id, edgeIndex, color)}
          onSelect={() => onSelectZone(element.id)}
          onMoveTo={(x, y) => onMoveZoneTo(element.id, x, y)}
          onResizeTo={(w, h) => onResizeZoneTo(element.id, w, h)}
        />
      ))}
    </div>
  )
}
