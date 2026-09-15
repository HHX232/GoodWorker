'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { distanceToSegment, INK_PALETTE, type ConstructionLine, type ThreeDZone, type VertexMark, type ZoneRect } from './shapeGeometry'
import { buildDashDotPositions, buildEdgeTopology, buildFaceTopology, buildGeometry, classifyEdges, createFramingCamera, getLocalSnapPoints, projectPoint, resolveLocalSnapPoint, type ClassifiedEdge, type EdgeTopology, type FaceTopology } from './threeDRender'
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
  onEdgeLabelChange: (edgeIndex: number, text: string) => void
  onVertexColorChange: (vertexIndex: number, color: string) => void
  onVertexLabelChange: (vertexIndex: number, text: string) => void
  onVertexMarkDelete: (vertexIndex: number) => void
  onLineColorChange: (lineId: string, color: string) => void
  onLineDelete: (lineId: string) => void
  onSelect: () => void
  onMoveTo: (x: number, y: number) => void
  onResizeTo: (width: number, height: number) => void
}

const PICK_THRESHOLD_PX = 8
const VERTEX_PICK_THRESHOLD_PX = 10
const MIN_ZONE_SIZE = 60

function colorFor(edgeIndex: number, zone: ThreeDZone): THREE.Color {
  return new THREE.Color(zone.edgeColors?.[edgeIndex] ?? zone.color)
}

function buildConstructionGeometry(topology: EdgeTopology[], faces: FaceTopology[], lines: ConstructionLine[]): { positions: number[]; colors: number[] } {
  const positions: number[] = []
  const colors: number[] = []
  for (const line of lines) {
    const p1 = resolveLocalSnapPoint(topology, faces, line.startRef)
    const p2 = resolveLocalSnapPoint(topology, faces, line.endRef)
    if (!p1 || !p2) continue
    const segPositions = buildDashDotPositions(p1, p2)
    positions.push(...segPositions)
    const c = new THREE.Color(line.color)
    for (let i = 0; i < segPositions.length / 3; i++) colors.push(c.r, c.g, c.b)
  }
  return { positions, colors }
}

type Picker =
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'line'; lineId: string }
  | { kind: 'vertex'; vertexIndex: number }

type EditingLabelTarget =
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'vertex'; vertexIndex: number }

interface EditingLabel {
  target: EditingLabelTarget
  text: string
  clientX: number
  clientY: number
}

export function ThreeDZoneCanvas({ rect, zone, viewTransform, interactive, onRotationCommit, onEdgeColorChange, onEdgeLabelChange, onVertexColorChange, onVertexLabelChange, onVertexMarkDelete, onLineColorChange, onLineDelete, onSelect, onMoveTo, onResizeTo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const solidLineRef = useRef<THREE.LineSegments | null>(null)
  const dashedLineRef = useRef<THREE.LineSegments | null>(null)
  const constructionLineRef = useRef<THREE.LineSegments | null>(null)
  const edgeTopologyRef = useRef<EdgeTopology[]>([])
  const faceTopologyRef = useRef<FaceTopology[]>([])
  const classifiedRef = useRef<ClassifiedEdge[]>([])
  const rotationRef = useRef({ x: zone.rotationX, y: zone.rotationY, z: zone.rotationZ })
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number }>({ active: false, moved: false, lastX: 0, lastY: 0 })
  const moveDragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const resizeDragRef = useRef<{ startClientX: number; startClientY: number; startWidth: number; startHeight: number } | null>(null)
  // Edge-label DOM nodes, keyed by edge index — positioned imperatively (not
  // via React state) from updateVisualization so a live rotation drag moves
  // them every frame without a setState per frame. Labels stay upright (no
  // CSS rotate to match the edge's projected angle) so they're always
  // legible regardless of the shape's current rotation; only their (left,
  // top) tracks the edge's live projected midpoint.
  const labelElRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // Vertex-mark ("angle mark") DOM nodes, keyed by vertex index — position
  // tracked the same way as edge labels; the small semicircle icon inside
  // each is additionally rotated to point away from the shape's centroid
  // (found via a querySelector on this same node in updateVisualization),
  // so it visually nestles into the corner instead of always facing one way.
  const vertexMarkElRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // The zone's DOM box (.zone/.canvasHolder) is sized in CSS to rect.width/
  // height * zoom — the renderer/camera must render at that same pixel size
  // (not the unzoomed rect.width/height), otherwise three.js's own inline
  // canvas style fights the container size: the shape looked "too small" at
  // high zoom and "too big" at low zoom because the canvas was always
  // rendered at a fixed rect.width×rect.height regardless of zoom.
  const canvasWidth = rect.width * viewTransform.zoom
  const canvasHeight = rect.height * viewTransform.zoom

  const [picker, setPicker] = useState<Picker | null>(null)
  const [editingLabel, setEditingLabel] = useState<EditingLabel | null>(null)

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

    const group = groupRef.current
    const camera = cameraRef.current
    if (group && camera) {
      for (const [edgeIndex, el] of labelElRefs.current) {
        const edge = edgeTopologyRef.current[edgeIndex]
        if (!edge) continue
        const mid = edge.v1.clone().add(edge.v2).multiplyScalar(0.5)
        const pos = projectPoint(mid, group, camera, canvasWidth, canvasHeight)
        el.style.left = `${pos.x}px`
        el.style.top = `${pos.y}px`
      }

      if (vertexMarkElRefs.current.size > 0) {
        const { vertices, centroid } = getLocalSnapPoints(edgeTopologyRef.current)
        const centroidPos = centroid ? projectPoint(centroid, group, camera, canvasWidth, canvasHeight) : null
        for (const [vertexIndex, el] of vertexMarkElRefs.current) {
          const vertex = vertices[vertexIndex]
          if (!vertex) continue
          const pos = projectPoint(vertex, group, camera, canvasWidth, canvasHeight)
          el.style.left = `${pos.x}px`
          el.style.top = `${pos.y}px`
          const svg = el.querySelector('svg')
          if (svg && centroidPos) {
            const angleDeg = Math.atan2(pos.y - centroidPos.y, pos.x - centroidPos.x) * (180 / Math.PI)
            ;(svg as unknown as HTMLElement).style.transform = `rotate(${angleDeg}deg)`
          }
        }
      }
    }

    applyColors()
  }, [applyColors, canvasWidth, canvasHeight])

  // Scene setup once — container captured locally (see ThreeDPanel's note on
  // why: React 18 dev StrictMode mounts/cleans up/mounts this effect once to
  // catch exactly this class of bug).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new THREE.Scene()
    const camera = createFramingCamera(canvasWidth, canvasHeight)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvasWidth, canvasHeight)
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
    faceTopologyRef.current = buildFaceTopology(geometry)
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
    const { positions, colors } = buildConstructionGeometry(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [])
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
  // through the panel) AND with the board's zoom — the rendered pixel size
  // must track zoom too, or the shape drifts out of proportion with its
  // zone's outline as the user zooms the whiteboard in/out.
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!renderer || !camera) return
    renderer.setSize(canvasWidth, canvasHeight)
    camera.aspect = Math.max(canvasWidth, 1) / Math.max(canvasHeight, 1)
    camera.updateProjectionMatrix()
    updateVisualization()
  }, [canvasWidth, canvasHeight, updateVisualization])

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
      const p1 = projectPoint(edge.v1, group, camera, canvasWidth, canvasHeight)
      const p2 = projectPoint(edge.v2, group, camera, canvasWidth, canvasHeight)
      const dist = distanceToSegment({ x: localX, y: localY }, p1, p2)
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = index
      }
    }
    return bestIndex !== -1 && bestDist <= PICK_THRESHOLD_PX ? { index: bestIndex, dist: bestDist } : null
  }, [canvasWidth, canvasHeight])

  const pickConstructionLine = useCallback((localX: number, localY: number): { id: string; dist: number } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera || !zone.constructionLines?.length) return null
    let bestId: string | null = null
    let bestDist = Infinity
    for (const line of zone.constructionLines) {
      const p1 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, line.startRef)
      const p2 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, line.endRef)
      if (!p1 || !p2) continue
      const s1 = projectPoint(p1, group, camera, canvasWidth, canvasHeight)
      const s2 = projectPoint(p2, group, camera, canvasWidth, canvasHeight)
      const dist = distanceToSegment({ x: localX, y: localY }, s1, s2)
      if (dist < bestDist) {
        bestDist = dist
        bestId = line.id
      }
    }
    return bestId !== null && bestDist <= PICK_THRESHOLD_PX ? { id: bestId, dist: bestDist } : null
  }, [canvasWidth, canvasHeight, zone.constructionLines])

  const pickVertex = useCallback((localX: number, localY: number): { index: number; dist: number } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera) return null
    const { vertices } = getLocalSnapPoints(edgeTopologyRef.current)
    let bestIndex = -1
    let bestDist = Infinity
    for (let index = 0; index < vertices.length; index++) {
      const p = projectPoint(vertices[index], group, camera, canvasWidth, canvasHeight)
      const dist = Math.hypot(localX - p.x, localY - p.y)
      if (dist < bestDist) {
        bestDist = dist
        bestIndex = index
      }
    }
    return bestIndex !== -1 && bestDist <= VERTEX_PICK_THRESHOLD_PX ? { index: bestIndex, dist: bestDist } : null
  }, [canvasWidth, canvasHeight])

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
    // A plain click (no drag): pick whichever of a vertex, a construction
    // line, or an edge is actually closest to the click, not a fixed
    // priority order — a median often runs close to a real edge in a
    // small/dense primitive, and a fixed priority made the loser
    // practically unselectable there. Vertices are checked too so clicking
    // a corner marks/selects it instead of the edge that happens to pass
    // through it.
    const box = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - box.left
    const localY = e.clientY - box.top
    const edgeHit = pickEdge(localX, localY)
    const lineHit = pickConstructionLine(localX, localY)
    const vertexHit = pickVertex(localX, localY)
    if (vertexHit && (!lineHit || vertexHit.dist <= lineHit.dist) && (!edgeHit || vertexHit.dist <= edgeHit.dist)) {
      if (!zone.vertexMarks?.[vertexHit.index]) onVertexColorChange(vertexHit.index, zone.color)
      setPicker({ kind: 'vertex', vertexIndex: vertexHit.index })
    } else if (lineHit && (!edgeHit || lineHit.dist <= edgeHit.dist)) {
      setPicker({ kind: 'line', lineId: lineHit.id })
    } else if (edgeHit) {
      setPicker({ kind: 'edge', edgeIndex: edgeHit.index })
    } else {
      setPicker(null)
    }
  }, [onRotationCommit, pickEdge, pickConstructionLine, pickVertex, onVertexColorChange, zone.vertexMarks, zone.color])

  // Double-click an edge or a vertex mark to write an arbitrary label on it
  // (length, angle value, anything) — positioned where the user clicked,
  // like the recolor popup used to be, since this one *is* a short-lived
  // text-entry gesture tied to that exact spot rather than a persistent
  // menu. A vertex with no mark yet gets one created on the spot, so
  // double-clicking a bare corner both marks and labels it in one gesture.
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - box.left
    const localY = e.clientY - box.top
    const vertexHit = pickVertex(localX, localY)
    const edgeHit = pickEdge(localX, localY)
    setPicker(null)
    if (vertexHit && (!edgeHit || vertexHit.dist <= edgeHit.dist)) {
      if (!zone.vertexMarks?.[vertexHit.index]) onVertexColorChange(vertexHit.index, zone.color)
      setEditingLabel({ target: { kind: 'vertex', vertexIndex: vertexHit.index }, text: zone.vertexMarks?.[vertexHit.index]?.label ?? '', clientX: e.clientX, clientY: e.clientY })
    } else if (edgeHit) {
      setEditingLabel({ target: { kind: 'edge', edgeIndex: edgeHit.index }, text: zone.edgeLabels?.[edgeHit.index] ?? '', clientX: e.clientX, clientY: e.clientY })
    }
  }, [pickVertex, pickEdge, zone.vertexMarks, zone.edgeLabels, zone.color, onVertexColorChange])

  const commitEditingLabel = useCallback(() => {
    if (!editingLabel) return
    const text = editingLabel.text.trim()
    if (editingLabel.target.kind === 'edge') onEdgeLabelChange(editingLabel.target.edgeIndex, text)
    else onVertexLabelChange(editingLabel.target.vertexIndex, text)
    setEditingLabel(null)
  }, [editingLabel, onEdgeLabelChange, onVertexLabelChange])

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
          onDoubleClick={interactive ? handleDoubleClick : undefined}
        />
        {zone.edgeLabels && Object.entries(zone.edgeLabels).map(([key, text]) => (
          <div
            key={key}
            ref={el => {
              const idx = Number(key)
              if (el) labelElRefs.current.set(idx, el)
              else labelElRefs.current.delete(idx)
            }}
            className={styles.edgeLabel}
          >
            {text}
          </div>
        ))}
        {zone.vertexMarks && Object.entries(zone.vertexMarks).map(([key, mark]: [string, VertexMark]) => (
          <div
            key={key}
            ref={el => {
              const idx = Number(key)
              if (el) vertexMarkElRefs.current.set(idx, el)
              else vertexMarkElRefs.current.delete(idx)
            }}
            className={styles.vertexMark}
            style={{ color: mark.color }}
          >
            <svg className={styles.vertexMarkIcon} viewBox="-7 -7 14 14" width="14" height="14">
              <path d="M 0 -6 A 6 6 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {mark.label && <span className={styles.vertexMarkLabel}>{mark.label}</span>}
          </div>
        ))}
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
        <div className={styles.colorPopover}>
          {INK_PALETTE.map(swatch => (
            <button
              key={swatch}
              type="button"
              className={styles.popoverSwatch}
              style={{ '--swatch-color': swatch } as React.CSSProperties}
              onClick={() => {
                if (picker.kind === 'edge') onEdgeColorChange(picker.edgeIndex, swatch)
                else if (picker.kind === 'vertex') onVertexColorChange(picker.vertexIndex, swatch)
                else onLineColorChange(picker.lineId, swatch)
                setPicker(null)
              }}
              title={swatch}
            />
          ))}
          {(picker.kind === 'line' || picker.kind === 'vertex') && (
            <button
              type="button"
              className={styles.popoverDelete}
              onClick={() => {
                if (picker.kind === 'line') onLineDelete(picker.lineId)
                else if (picker.kind === 'vertex') onVertexMarkDelete(picker.vertexIndex)
                setPicker(null)
              }}
              title={picker.kind === 'line' ? 'Удалить линию' : 'Удалить отметку'}
            >
              🗑
            </button>
          )}
        </div>
      )}
      {editingLabel && (
        <input
          type="text"
          autoFocus
          className={styles.labelInput}
          style={{ left: editingLabel.clientX, top: editingLabel.clientY }}
          value={editingLabel.text}
          placeholder={editingLabel.target.kind === 'edge' ? 'Текст на ребре' : 'Текст на угле'}
          onChange={e => setEditingLabel(prev => (prev ? { ...prev, text: e.target.value } : prev))}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEditingLabel()
            else if (e.key === 'Escape') setEditingLabel(null)
          }}
          onBlur={commitEditingLabel}
        />
      )}
    </>
  )
}
