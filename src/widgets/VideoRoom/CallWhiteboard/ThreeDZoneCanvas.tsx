'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { distanceToSegment, INK_PALETTE, type ConstructionLine, type ThreeDZone, type ZoneRect } from './shapeGeometry'
import { buildDashDotPositions, buildEdgeTopology, buildGeometry, classifyEdges, createFramingCamera, projectPoint, resolveLocalSnapPoint, type ClassifiedEdge, type EdgeTopology } from './threeDRender'
import styles from './ThreeDZoneCanvas.module.scss'

interface ViewTransform {
  scrollX: number
  scrollY: number
  zoom: number
}

interface Props {
  rect: ZoneRect
  zone: ThreeDZone
  viewTransform: ViewTransform
  /** False while a drawing tool is active — lets clicks through to Excalidraw
   * so it can draw directly over the shape instead of us grabbing the drag. */
  interactive: boolean
  onRotationCommit: (rotationX: number, rotationY: number, rotationZ: number) => void
  onEdgeColorChange: (edgeIndex: number, color: string) => void
  onLineColorChange: (lineId: string, color: string) => void
  onLineDelete: (lineId: string) => void
  onSelect: () => void
  onMoveTo: (x: number, y: number) => void
  onResizeTo: (width: number, height: number) => void
}

const PICK_THRESHOLD_PX = 8
const MIN_ZONE_SIZE = 60

function colorFor(edgeIndex: number, zone: ThreeDZone): THREE.Color {
  return new THREE.Color(zone.edgeColors?.[edgeIndex] ?? zone.color)
}

function buildConstructionGeometry(topology: EdgeTopology[], lines: ConstructionLine[]): { positions: number[]; colors: number[] } {
  const positions: number[] = []
  const colors: number[] = []
  for (const line of lines) {
    const p1 = resolveLocalSnapPoint(topology, line.startRef)
    const p2 = resolveLocalSnapPoint(topology, line.endRef)
    if (!p1 || !p2) continue
    const segPositions = buildDashDotPositions(p1, p2)
    positions.push(...segPositions)
    const c = new THREE.Color(line.color)
    for (let i = 0; i < segPositions.length / 3; i++) colors.push(c.r, c.g, c.b)
  }
  return { positions, colors }
}

type Picker =
  | { kind: 'edge'; edgeIndex: number; clientX: number; clientY: number }
  | { kind: 'line'; lineId: string; clientX: number; clientY: number }

export function ThreeDZoneCanvas({ rect, zone, viewTransform, interactive, onRotationCommit, onEdgeColorChange, onLineColorChange, onLineDelete, onSelect, onMoveTo, onResizeTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const solidLineRef = useRef<THREE.LineSegments | null>(null)
  const dashedLineRef = useRef<THREE.LineSegments | null>(null)
  const constructionLineRef = useRef<THREE.LineSegments | null>(null)
  const edgeTopologyRef = useRef<EdgeTopology[]>([])
  const classifiedRef = useRef<ClassifiedEdge[]>([])
  const rotationRef = useRef({ x: zone.rotationX, y: zone.rotationY, z: zone.rotationZ })
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number }>({ active: false, moved: false, lastX: 0, lastY: 0 })
  const moveDragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const resizeDragRef = useRef<{ startClientX: number; startClientY: number; startWidth: number; startHeight: number } | null>(null)

  // clientX/clientY (raw viewport coords), not zone-local ones — rendered
  // with position:fixed below so it's fully decoupled from the zone's own
  // transform. It was drifting with the cursor because its local coordinates
  // were being recomputed relative to a container that re-renders on nearly
  // every pointer move (the zone tracks viewTransform on every board change).
  const [picker, setPicker] = useState<Picker | null>(null)

  const render = useCallback(() => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
  }, [])

  const applyColors = useCallback(() => {
    const solidLine = solidLineRef.current
    const dashedLine = dashedLineRef.current
    if (!solidLine || !dashedLine) return
    const solidColors: number[] = []
    const dashedColors: number[] = []
    classifiedRef.current.forEach((edge, index) => {
      const c = colorFor(index, zone)
      const target = edge.dashed ? dashedColors : solidColors
      target.push(c.r, c.g, c.b, c.r, c.g, c.b)
    })
    solidLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3))
    dashedLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(dashedColors, 3))
    render()
  }, [zone, render])

  const updateVisualization = useCallback(() => {
    const solidLine = solidLineRef.current
    const dashedLine = dashedLineRef.current
    if (!solidLine || !dashedLine) return
    classifiedRef.current = classifyEdges(edgeTopologyRef.current, rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)

    const solidPositions: number[] = []
    const dashedPositions: number[] = []
    for (const edge of classifiedRef.current) {
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

    applyColors()
  }, [applyColors])

  // Scene setup once — container captured locally (see ThreeDPanel's note on
  // why: React 18 dev StrictMode mounts/cleans up/mounts this effect once to
  // catch exactly this class of bug).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new THREE.Scene()
    const camera = createFramingCamera(rect.width, rect.height)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(rect.width, rect.height)
    container.appendChild(renderer.domElement)

    const group = new THREE.Group()
    group.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
    group.scale.setScalar(zone.scale)
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
      constructionLineRef.current?.geometry.dispose()
      ;(constructionLineRef.current?.material as THREE.Material | undefined)?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      groupRef.current = null
      solidLineRef.current = null
      dashedLineRef.current = null
      constructionLineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild topology + the two line meshes when the primitive/segments/flat
  // change. vertexColors so each edge can carry its own override color.
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

    const geometry = buildGeometry(zone.primitive, zone.segments ?? 0, zone.flat ?? false)
    edgeTopologyRef.current = buildEdgeTopology(geometry)
    geometry.dispose()

    const solidLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true }))
    group.add(solidLine)
    solidLineRef.current = solidLine

    const dashedLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 0.07, gapSize: 0.06 }))
    group.add(dashedLine)
    dashedLineRef.current = dashedLine

    updateVisualization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.primitive, zone.segments, zone.flat])

  // Construction lines (medians/bisectors drawn fully inside this shape) —
  // children of the same group as the shape's own edges, so they rotate and
  // scale with it automatically during a live drag, no rebind-on-commit
  // needed. Rebuilt when the lines themselves change, or when the topology
  // they're anchored to does (primitive/segments/flat).
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    if (constructionLineRef.current) {
      group.remove(constructionLineRef.current)
      constructionLineRef.current.geometry.dispose()
      ;(constructionLineRef.current.material as THREE.Material).dispose()
    }
    const { positions, colors } = buildConstructionGeometry(edgeTopologyRef.current, zone.constructionLines ?? [])
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }))
    group.add(line)
    constructionLineRef.current = line
    render()
  }, [zone.primitive, zone.segments, zone.flat, zone.constructionLines, render])

  // Colors changed (base or per-edge overrides) without a topology rebuild.
  useEffect(() => {
    applyColors()
  }, [applyColors])

  // Rotation changed externally (panel edit, another participant) — skip
  // while a local drag is in progress so we don't fight the user's gesture.
  useEffect(() => {
    if (dragRef.current.active) return
    rotationRef.current = { x: zone.rotationX, y: zone.rotationY, z: zone.rotationZ }
    groupRef.current?.rotation.set(zone.rotationX, zone.rotationY, zone.rotationZ)
    updateVisualization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.rotationX, zone.rotationY, zone.rotationZ])

  useEffect(() => {
    groupRef.current?.scale.setScalar(zone.scale)
    render()
  }, [zone.scale, render])

  // Resize with the zone's on-board size (our own resize handle, or an edit
  // through the panel).
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!renderer || !camera) return
    renderer.setSize(rect.width, rect.height)
    camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1)
    camera.updateProjectionMatrix()
    render()
  }, [rect.width, rect.height, render])

  // Returns the closest edge within the pick threshold, plus its distance —
  // distance is needed by the caller to arbitrate against a construction
  // line that might be even closer to the same click (see handlePointerUp;
  // a fixed "edges always win" priority made lines effectively unselectable
  // whenever they ran near an actual edge, which is common for medians in
  // small/dense primitives).
  const pickEdge = useCallback((localX: number, localY: number): { index: number; dist: number } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera) return null
    let bestIndex = -1
    let bestDist = Infinity
    for (let index = 0; index < classifiedRef.current.length; index++) {
      const edge = classifiedRef.current[index]
      const p1 = projectPoint(edge.v1, group, camera, rect.width, rect.height)
      const p2 = projectPoint(edge.v2, group, camera, rect.width, rect.height)
      const dist = distanceToSegment({ x: localX, y: localY }, p1, p2)
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = index
      }
    }
    return bestIndex !== -1 && bestDist <= PICK_THRESHOLD_PX ? { index: bestIndex, dist: bestDist } : null
  }, [rect.width, rect.height])

  const pickConstructionLine = useCallback((localX: number, localY: number): { id: string; dist: number } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera || !zone.constructionLines?.length) return null
    let bestId: string | null = null
    let bestDist = Infinity
    for (const line of zone.constructionLines) {
      const p1 = resolveLocalSnapPoint(edgeTopologyRef.current, line.startRef)
      const p2 = resolveLocalSnapPoint(edgeTopologyRef.current, line.endRef)
      if (!p1 || !p2) continue
      const s1 = projectPoint(p1, group, camera, rect.width, rect.height)
      const s2 = projectPoint(p2, group, camera, rect.width, rect.height)
      const dist = distanceToSegment({ x: localX, y: localY }, s1, s2)
      if (dist < bestDist) {
        bestDist = dist
        bestId = line.id
      }
    }
    return bestId !== null && bestDist <= PICK_THRESHOLD_PX ? { id: bestId, dist: bestDist } : null
  }, [rect.width, rect.height, zone.constructionLines])

  // Rotate is the default gesture on the shape body — no mode to enter first.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setPicker(null)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true
    if (!dragRef.current.moved) return
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY
    rotationRef.current = {
      ...rotationRef.current,
      x: rotationRef.current.x + dy * 0.01,
      y: rotationRef.current.y + dx * 0.01,
    }
    groupRef.current?.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
    updateVisualization()
  }, [updateVisualization])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragRef.current.moved
    dragRef.current.active = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}

    if (wasDragging) {
      onRotationCommit(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
      return
    }
    // A plain click (no drag): pick whichever of an edge or a construction
    // line is actually closer to the click, not "edge always wins" — a
    // median often runs close to a real edge in a small/dense primitive, and
    // a fixed edge-first priority made it practically unselectable there.
    const box = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - box.left
    const localY = e.clientY - box.top
    const edgeHit = pickEdge(localX, localY)
    const lineHit = pickConstructionLine(localX, localY)
    if (lineHit && (!edgeHit || lineHit.dist <= edgeHit.dist)) {
      setPicker({ kind: 'line', lineId: lineHit.id, clientX: e.clientX, clientY: e.clientY })
    } else if (edgeHit) {
      setPicker({ kind: 'edge', edgeIndex: edgeHit.index, clientX: e.clientX, clientY: e.clientY })
    } else {
      setPicker(null)
    }
  }, [onRotationCommit, pickEdge, pickConstructionLine])

  // Move handle: click selects the zone (surfaces the rename/edit inspector),
  // drag moves it. Delta is tracked from the drag's own start, not
  // accumulated per-frame, so it can't drift.
  const handleMoveDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    moveDragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: rect.x, startY: rect.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [rect.x, rect.y])

  const handleMoveMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = moveDragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startClientX) / viewTransform.zoom
    const dy = (e.clientY - drag.startClientY) / viewTransform.zoom
    onMoveTo(drag.startX + dx, drag.startY + dy)
  }, [onMoveTo, viewTransform.zoom])

  const handleMoveUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const wasDrag = moveDragRef.current && (e.clientX !== moveDragRef.current.startClientX || e.clientY !== moveDragRef.current.startClientY)
    moveDragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    if (!wasDrag) onSelect()
  }, [onSelect])

  // Resize handle: uniform scale, driven by horizontal drag distance.
  const handleResizeDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    resizeDragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startWidth: rect.width, startHeight: rect.height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [rect.width, rect.height])

  const handleResizeMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = resizeDragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startClientX) / viewTransform.zoom
    const nextWidth = Math.max(MIN_ZONE_SIZE, drag.startWidth + dx)
    const scaleFactor = nextWidth / drag.startWidth
    onResizeTo(nextWidth, Math.max(MIN_ZONE_SIZE, drag.startHeight * scaleFactor))
  }, [onResizeTo, viewTransform.zoom])

  const handleResizeUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    resizeDragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }, [])

  const left = (rect.x + viewTransform.scrollX) * viewTransform.zoom
  const top = (rect.y + viewTransform.scrollY) * viewTransform.zoom
  const width = rect.width * viewTransform.zoom
  const height = rect.height * viewTransform.zoom

  return (
    <>
      <div className={styles.zone} style={{ left, top, width, height, transform: `rotate(${rect.angle}rad)` }}>
        <div
          ref={containerRef}
          className={styles.canvasHolder}
          data-interactive={interactive || undefined}
          onPointerDown={interactive ? handlePointerDown : undefined}
          onPointerMove={interactive ? handlePointerMove : undefined}
          onPointerUp={interactive ? handlePointerUp : undefined}
          onPointerLeave={interactive ? handlePointerUp : undefined}
        />
        <button
          type="button"
          className={styles.moveHandle}
          onPointerDown={handleMoveDown}
          onPointerMove={handleMoveMove}
          onPointerUp={handleMoveUp}
          title="Перетащите — переместить фигуру. Клик — выделить."
        >
          ✥
        </button>
        <button
          type="button"
          className={styles.resizeHandle}
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          title="Перетащите — изменить размер"
        >
          ⤡
        </button>
      </div>
      {picker && (
        <div className={styles.colorPopover} style={{ left: picker.clientX, top: picker.clientY }}>
          {INK_PALETTE.map(swatch => (
            <button
              key={swatch}
              type="button"
              className={styles.popoverSwatch}
              style={{ '--swatch-color': swatch } as React.CSSProperties}
              onClick={() => {
                if (picker.kind === 'edge') onEdgeColorChange(picker.edgeIndex, swatch)
                else onLineColorChange(picker.lineId, swatch)
                setPicker(null)
              }}
              title={swatch}
            />
          ))}
          {picker.kind === 'line' && (
            <button
              type="button"
              className={styles.popoverDelete}
              onClick={() => {
                onLineDelete(picker.lineId)
                setPicker(null)
              }}
              title="Удалить линию"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </>
  )
}
