'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTranslations } from 'next-intl'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import {
  DEFAULT_SEGMENTS,
  INK_PALETTE,
  SEGMENT_ADJUSTABLE,
  themedColor,
  type ShapeId,
  type ThreeDShapeMeta,
} from './shapeGeometry'
import { buildEdgeTopology, buildGeometry, classifyEdges, splitSolidDashedPositions, type EdgeTopology } from './threeDRender'
import styles from './ThreeDPanel.module.scss'

const SHAPE_OPTIONS: ShapeId[] = ['cube', 'pyramid', 'cone', 'cylinder', 'sphere', 'polygon']
const DEFAULT_ROTATION = { x: -0.5, y: 0.7, z: 0 }
const CANVAS_SIZE = 220

interface Props {
  initial?: ThreeDShapeMeta
  onInsert: (shape: ThreeDShapeMeta) => void
  onClose: () => void
}

export function ThreeDPanel({ initial, onInsert, onClose }: Props) {
  const t = useTranslations('whiteboard')
  const { isDark } = useThemeCtx()
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const solidLineRef = useRef<THREE.LineSegments | null>(null)
  const dashedLineRef = useRef<THREE.LineSegments | null>(null)
  const edgeTopologyRef = useRef<EdgeTopology[]>([])
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({ active: false, lastX: 0, lastY: 0 })
  const rotationRef = useRef({
    x: initial?.rotationX ?? DEFAULT_ROTATION.x,
    y: initial?.rotationY ?? DEFAULT_ROTATION.y,
    z: initial?.rotationZ ?? DEFAULT_ROTATION.z,
  })

  const [primitive, setPrimitive] = useState<ShapeId>(initial?.primitive ?? 'cube')
  const [scale, setScale] = useState(initial?.scale ?? 1)
  const [color, setColor] = useState(initial?.color ?? (isDark ? '#ececec' : '#1e1e1e'))
  const [segments, setSegments] = useState(initial?.segments ?? DEFAULT_SEGMENTS[initial?.primitive ?? 'cube'])
  const [flat, setFlat] = useState(initial?.flat ?? false)
  // Roll (Z) isn't reachable by 2-axis drag — a slider covers the 3rd axis.
  const [rollDisplay, setRollDisplay] = useState(initial?.rotationZ ?? DEFAULT_ROTATION.z)

  const render = useCallback(() => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
  }, [])

  // Re-split the current topology into visible/hidden segments for the
  // shape's rotation right now, and push that into the two line meshes.
  // Cheap enough to call on every drag frame — only the classification (a
  // dot product per edge) is redone, not the topology walk above.
  const updateVisualization = useCallback(() => {
    const solidLine = solidLineRef.current
    const dashedLine = dashedLineRef.current
    if (!solidLine || !dashedLine) return
    const classified = classifyEdges(edgeTopologyRef.current, rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
    const { solid, dashed } = splitSolidDashedPositions(classified)

    solidLine.geometry.dispose()
    const solidGeometry = new THREE.BufferGeometry()
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solid, 3))
    solidLine.geometry = solidGeometry

    dashedLine.geometry.dispose()
    const dashedGeometry = new THREE.BufferGeometry()
    dashedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dashed, 3))
    dashedLine.geometry = dashedGeometry
    dashedLine.computeLineDistances()

    render()
  }, [render])

  // Set up the scene once. The container is captured into a local instead of
  // re-read from the ref at cleanup time — in React 18 dev StrictMode this
  // effect mounts, cleans up and mounts again immediately to surface exactly
  // this kind of bug, and re-reading `containerRef.current` at cleanup found
  // it stale, so the old <canvas> was never actually removed: the second
  // mount appended its own on top, leaving two overlapping renderers.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 4.6)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE)
    container.appendChild(renderer.domElement)

    const group = new THREE.Group()
    group.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
    group.scale.setScalar(scale)
    scene.add(group)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    groupRef.current = group

    return () => {
      solidLineRef.current?.geometry.dispose()
      ;(solidLineRef.current?.material as THREE.Material | undefined)?.dispose()
      dashedLineRef.current?.geometry.dispose()
      ;(dashedLineRef.current?.material as THREE.Material | undefined)?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      groupRef.current = null
      solidLineRef.current = null
      dashedLineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild the topology and the two (solid/dashed) line meshes when the
  // primitive, its segment count, flatness or color changes.
  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    if (solidLineRef.current) {
      group.remove(solidLineRef.current)
      solidLineRef.current.geometry.dispose()
      ;(solidLineRef.current.material as THREE.Material).dispose()
    }
    if (dashedLineRef.current) {
      group.remove(dashedLineRef.current)
      dashedLineRef.current.geometry.dispose()
      ;(dashedLineRef.current.material as THREE.Material).dispose()
    }

    const geometry = buildGeometry(primitive, segments, flat)
    edgeTopologyRef.current = buildEdgeTopology(geometry)
    geometry.dispose()

    // themedColor here, not on the `color` state itself — `color` is what
    // gets saved into the shape (and shown as the active swatch), this only
    // affects how it's actually drawn so an existing shape edited while the
    // board happens to be in the other theme doesn't preview as invisible.
    const displayColor = themedColor(color, isDark)
    const solidLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: displayColor }))
    group.add(solidLine)
    solidLineRef.current = solidLine

    const dashedLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: displayColor, dashSize: 0.07, gapSize: 0.06 }))
    group.add(dashedLine)
    dashedLineRef.current = dashedLine

    updateVisualization()
  }, [primitive, segments, flat, color, isDark, updateVisualization])

  // Apply scale changes without rebuilding the mesh — uniform scale doesn't
  // change which faces point toward the camera, so visibility stays as-is.
  useEffect(() => {
    groupRef.current?.scale.setScalar(scale)
    render()
  }, [scale, render])

  const applyRotation = useCallback(() => {
    groupRef.current?.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
    updateVisualization()
  }, [updateVisualization])

  const handlePrimitiveSelect = useCallback((value: ShapeId) => {
    setPrimitive(value)
    setSegments(DEFAULT_SEGMENTS[value])
    if (value !== 'polygon') setFlat(false)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
    rotationRef.current = {
      ...rotationRef.current,
      x: rotationRef.current.x + dy * 0.01,
      y: rotationRef.current.y + dx * 0.01,
    }
    applyRotation()
  }, [applyRotation])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }, [])

  const handleRollChange = useCallback((value: number) => {
    setRollDisplay(value)
    rotationRef.current = { ...rotationRef.current, z: value }
    applyRotation()
  }, [applyRotation])

  const handleInsert = useCallback(() => {
    onInsert({
      primitive,
      rotationX: rotationRef.current.x,
      rotationY: rotationRef.current.y,
      rotationZ: rotationRef.current.z,
      scale,
      color,
      segments: SEGMENT_ADJUSTABLE.has(primitive) ? segments : undefined,
      flat: primitive === 'polygon' ? flat : undefined,
      label: initial?.label,
    })
  }, [onInsert, primitive, scale, color, segments, flat, initial?.label])

  const showSegments = SEGMENT_ADJUSTABLE.has(primitive)

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t('shapePanel.title')}</div>
      <div className={styles.shapeRow}>
        {SHAPE_OPTIONS.map(value => (
          <button
            key={value}
            type="button"
            className={`${styles.shapeButton} ${primitive === value ? styles.shapeButtonActive : ''}`}
            onClick={() => handlePrimitiveSelect(value)}
          >
            {t(`shapes.${value}`)}
          </button>
        ))}
      </div>
      {primitive === 'polygon' && (
        <label className={styles.flatToggle}>
          <input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} />
          {t('shapePanel.flat2d')}
        </label>
      )}
      <div
        ref={containerRef}
        className={styles.viewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className={styles.hint}>{t('shapePanel.rotateHint')}</div>
      <label className={styles.scaleRow}>
        <span className={styles.scaleLabel}>{t('shapePanel.scale')}</span>
        <input
          className={styles.slider}
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
        />
      </label>
      <label className={styles.scaleRow}>
        <span className={styles.scaleLabel}>{t('shapePanel.rotationZ')}</span>
        <input
          className={styles.slider}
          type="range"
          min={-180}
          max={180}
          step={1}
          value={Math.round(THREE.MathUtils.radToDeg(rollDisplay))}
          onChange={e => handleRollChange(THREE.MathUtils.degToRad(Number(e.target.value)))}
        />
      </label>
      {showSegments && (
        <label className={styles.scaleRow}>
          <span className={styles.scaleLabel}>{primitive === 'polygon' ? t('shapePanel.cornerCount') : t('shapePanel.visibleEdges')}</span>
          <input
            className={styles.slider}
            type="range"
            min={primitive === 'polygon' ? 3 : 6}
            max={primitive === 'polygon' ? 12 : 40}
            step={1}
            value={segments}
            onChange={e => setSegments(Number(e.target.value))}
          />
          <span className={styles.scaleValue}>{segments}</span>
        </label>
      )}
      <div className={styles.colorRow}>
        {INK_PALETTE.map(swatch => (
          <button
            key={swatch}
            type="button"
            className={`${styles.swatch} ${color === swatch ? styles.swatchActive : ''}`}
            style={{ '--swatch-color': swatch } as React.CSSProperties}
            onClick={() => setColor(swatch)}
            title={swatch}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          {t('formulaKeyboard.cancel')}
        </button>
        <button type="button" className={styles.insert} onClick={handleInsert}>
          {t('formulaKeyboard.insert')}
        </button>
      </div>
    </div>
  )
}
