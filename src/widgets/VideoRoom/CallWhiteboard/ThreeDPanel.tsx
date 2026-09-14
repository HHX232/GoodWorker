'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { INK_PALETTE, PRIMITIVE_LABELS, type ProjectedEdge, type ShapeId, type ThreeDInsertPayload, type ThreeDShapeMeta } from './shapeGeometry'
import styles from './ThreeDPanel.module.scss'

const SHAPE_OPTIONS: ShapeId[] = ['cube', 'pyramid', 'cone', 'cylinder', 'sphere']
const DEFAULT_ROTATION = { x: -0.5, y: 0.7 }
const CANVAS_SIZE = 220
const CREASE_ANGLE_THRESHOLD = THREE.MathUtils.degToRad(1)
// A shape's own surface is what can hide part of its own edges here (no
// other objects in this scene) — so the classification below only needs to
// answer "does the shape's near side block this edge", not a full depth test.
const VIEW_DIR = new THREE.Vector3(0, 0, 1)

function buildGeometry(primitive: ShapeId): THREE.BufferGeometry {
  switch (primitive) {
    case 'cube':
      return new THREE.BoxGeometry(1.5, 1.5, 1.5)
    case 'pyramid':
      return new THREE.ConeGeometry(1.1, 1.7, 4)
    case 'cone':
      return new THREE.ConeGeometry(1.1, 1.7, 32)
    case 'cylinder':
      return new THREE.CylinderGeometry(0.9, 0.9, 1.6, 28)
    case 'sphere':
      return new THREE.SphereGeometry(1.1, 18, 12)
  }
}

interface EdgeTopology {
  v1: THREE.Vector3
  v2: THREE.Vector3
  normalA: THREE.Vector3
  normalB: THREE.Vector3 | null
}

/**
 * For a convex solid, a point is visible from an external camera iff it lies
 * on a front-facing face — so an edge shared by two faces is either fully
 * visible or fully hidden, never partially (the ray from the camera to any
 * point on it is blocked, or not, by the same near surface for the whole
 * edge). This walks the source triangles once per primitive to find each
 * edge's one or two adjacent face normals, in local (unrotated) space.
 */
function buildEdgeTopology(geometry: THREE.BufferGeometry): EdgeTopology[] {
  const index = geometry.index
  const position = geometry.attributes.position
  if (!index) return []

  const indexArray = index.array
  const triCount = indexArray.length / 3

  // Built-in three.js geometries duplicate vertices along UV seams (e.g. the
  // sphere/cylinder wrap-around), so edges across a seam don't share an
  // index. Weld by position first so adjacency still matches there.
  const weldedId = new Map<string, number>()
  const weldOf = new Int32Array(position.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const key = `${v.x.toFixed(4)}_${v.y.toFixed(4)}_${v.z.toFixed(4)}`
    let id = weldedId.get(key)
    if (id === undefined) {
      id = weldedId.size
      weldedId.set(key, id)
    }
    weldOf[i] = id
  }

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const faceNormals: THREE.Vector3[] = []
  for (let t = 0; t < triCount; t++) {
    vA.fromBufferAttribute(position, indexArray[t * 3])
    vB.fromBufferAttribute(position, indexArray[t * 3 + 1])
    vC.fromBufferAttribute(position, indexArray[t * 3 + 2])
    faceNormals.push(new THREE.Vector3().subVectors(vC, vB).cross(vA.clone().sub(vB)).normalize())
  }

  const edgeTriangles = new Map<string, number[]>()
  const edgeVerts = new Map<string, [number, number]>()
  for (let t = 0; t < triCount; t++) {
    const corners: [number, number][] = [
      [indexArray[t * 3], indexArray[t * 3 + 1]],
      [indexArray[t * 3 + 1], indexArray[t * 3 + 2]],
      [indexArray[t * 3 + 2], indexArray[t * 3]],
    ]
    for (const [p, q] of corners) {
      const a = weldOf[p]
      const b = weldOf[q]
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!edgeVerts.has(key)) edgeVerts.set(key, [p, q])
      const entry = edgeTriangles.get(key)
      if (entry) entry.push(t)
      else edgeTriangles.set(key, [t])
    }
  }

  const topology: EdgeTopology[] = []
  for (const [key, tris] of edgeTriangles) {
    const [p, q] = edgeVerts.get(key)!
    const v1 = new THREE.Vector3().fromBufferAttribute(position, p)
    const v2 = new THREE.Vector3().fromBufferAttribute(position, q)
    if (tris.length < 2) {
      // Open boundary edge — shouldn't happen for these closed solids, but
      // default to always-visible defensively.
      topology.push({ v1, v2, normalA: faceNormals[tris[0]], normalB: null })
      continue
    }
    const normalA = faceNormals[tris[0]]
    const normalB = faceNormals[tris[1]]
    if (normalA.angleTo(normalB) > CREASE_ANGLE_THRESHOLD) {
      topology.push({ v1, v2, normalA, normalB })
    }
  }
  return topology
}

interface ClassifiedEdge {
  v1: THREE.Vector3
  v2: THREE.Vector3
  dashed: boolean
}

function classifyEdges(topology: EdgeTopology[], rotationX: number, rotationY: number): ClassifiedEdge[] {
  const euler = new THREE.Euler(rotationX, rotationY, 0)
  const nA = new THREE.Vector3()
  const nB = new THREE.Vector3()
  return topology.map(edge => {
    nA.copy(edge.normalA).applyEuler(euler)
    const frontA = nA.dot(VIEW_DIR) > 0
    let dashed = false
    if (edge.normalB) {
      nB.copy(edge.normalB).applyEuler(euler)
      const frontB = nB.dot(VIEW_DIR) > 0
      dashed = !frontA && !frontB
    }
    return { v1: edge.v1, v2: edge.v2, dashed }
  })
}

function projectClassifiedEdges(edges: ClassifiedEdge[], group: THREE.Group, camera: THREE.PerspectiveCamera): ProjectedEdge[] {
  group.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  return edges.map(edge => {
    p1.copy(edge.v1).applyMatrix4(group.matrixWorld).project(camera)
    p2.copy(edge.v2).applyMatrix4(group.matrixWorld).project(camera)
    return {
      x1: (p1.x * 0.5 + 0.5) * CANVAS_SIZE,
      y1: (1 - (p1.y * 0.5 + 0.5)) * CANVAS_SIZE,
      x2: (p2.x * 0.5 + 0.5) * CANVAS_SIZE,
      y2: (1 - (p2.y * 0.5 + 0.5)) * CANVAS_SIZE,
      dashed: edge.dashed,
    }
  })
}

interface Props {
  initial?: ThreeDShapeMeta
  onInsert: (shape: ThreeDInsertPayload) => void
  onClose: () => void
}

export function ThreeDPanel({ initial, onInsert, onClose }: Props) {
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
  const rotationRef = useRef({ x: initial?.rotationX ?? DEFAULT_ROTATION.x, y: initial?.rotationY ?? DEFAULT_ROTATION.y })

  const [primitive, setPrimitive] = useState<ShapeId>(initial?.primitive ?? 'cube')
  const [scale, setScale] = useState(initial?.scale ?? 1)
  const [color, setColor] = useState(initial?.color ?? (isDark ? '#ececec' : '#1e1e1e'))

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
    const classified = classifyEdges(edgeTopologyRef.current, rotationRef.current.x, rotationRef.current.y)

    const solidPositions: number[] = []
    const dashedPositions: number[] = []
    for (const edge of classified) {
      const target = edge.dashed ? dashedPositions : solidPositions
      target.push(edge.v1.x, edge.v1.y, edge.v1.z, edge.v2.x, edge.v2.y, edge.v2.z)
    }

    solidLine.geometry.dispose()
    const solidGeometry = new THREE.BufferGeometry()
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3))
    solidLine.geometry = solidGeometry

    dashedLine.geometry.dispose()
    const dashedGeometry = new THREE.BufferGeometry()
    dashedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dashedPositions, 3))
    dashedLine.geometry = dashedGeometry
    dashedLine.computeLineDistances()

    render()
  }, [render])

  // Set up the scene once
  useEffect(() => {
    if (!containerRef.current) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 4.6)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE)
    containerRef.current.appendChild(renderer.domElement)

    const group = new THREE.Group()
    group.rotation.set(rotationRef.current.x, rotationRef.current.y, 0)
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
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
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
  // primitive or color changes.
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

    const geometry = buildGeometry(primitive)
    edgeTopologyRef.current = buildEdgeTopology(geometry)
    geometry.dispose()

    const solidLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }))
    group.add(solidLine)
    solidLineRef.current = solidLine

    const dashedLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color, dashSize: 0.07, gapSize: 0.06 }))
    group.add(dashedLine)
    dashedLineRef.current = dashedLine

    updateVisualization()
  }, [primitive, color, updateVisualization])

  // Apply scale changes without rebuilding the mesh — uniform scale doesn't
  // change which faces point toward the camera, so visibility stays as-is.
  useEffect(() => {
    groupRef.current?.scale.setScalar(scale)
    render()
  }, [scale, render])

  const applyRotation = useCallback(() => {
    groupRef.current?.rotation.set(rotationRef.current.x, rotationRef.current.y, 0)
    updateVisualization()
  }, [updateVisualization])

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
      x: rotationRef.current.x + dy * 0.01,
      y: rotationRef.current.y + dx * 0.01,
    }
    applyRotation()
  }, [applyRotation])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }, [])

  const handleInsert = useCallback(() => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera) return
    const classified = classifyEdges(edgeTopologyRef.current, rotationRef.current.x, rotationRef.current.y)
    const edges = projectClassifiedEdges(classified, group, camera)
    onInsert({
      primitive,
      rotationX: rotationRef.current.x,
      rotationY: rotationRef.current.y,
      scale,
      color,
      edges,
    })
  }, [onInsert, primitive, scale, color])

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Фигуры</div>
      <div className={styles.shapeRow}>
        {SHAPE_OPTIONS.map(value => (
          <button
            key={value}
            type="button"
            className={`${styles.shapeButton} ${primitive === value ? styles.shapeButtonActive : ''}`}
            onClick={() => setPrimitive(value)}
          >
            {PRIMITIVE_LABELS[value]}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className={styles.viewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className={styles.hint}>Потяните фигуру, чтобы повернуть — скрытые рёбра идут пунктиром</div>
      <label className={styles.scaleRow}>
        <span className={styles.scaleLabel}>Масштаб</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
        />
      </label>
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
          Отмена
        </button>
        <button type="button" className={styles.insert} onClick={handleInsert}>
          Вставить на доску
        </button>
      </div>
    </div>
  )
}
