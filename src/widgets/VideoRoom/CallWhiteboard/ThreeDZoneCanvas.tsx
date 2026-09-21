'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTranslations } from 'next-intl'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import { angleArmsEqual, distanceToSegment, INK_PALETTE, themedColor, type AngleArm, type ConstructionLine, type ThreeDZone, type VertexMark, type ZoneRect, type ZoneSelection } from './shapeGeometry'
import { BASE_CAMERA_DISTANCE, buildAngleArcPoints, buildDashDotPositions, buildEdgeTopology, buildFaceTopology, buildGeometry, classifyEdges, createFramingCamera, projectPoint, resolveAngleGeometry, resolveArmEndpoints, resolveLocalSnapPoint, type ClassifiedEdge, type EdgeTopology, type FaceTopology } from './threeDRender'
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
  /** "∠ Угол" tool active — a plain click finds whichever two arms (a
   * shape edge and/or a construction line) sharing an endpoint are closest
   * to the click, creating/selecting the angle mark there. Off, plain
   * clicks fall back to the normal edge/line/existing-angle-mark picking
   * (rotate-drag works in both cases). */
  angleMode: boolean
  onRotationCommit: (rotationX: number, rotationY: number, rotationZ: number) => void
  onEdgeColorChange: (edgeIndex: number, color: string) => void
  onEdgeLabelChange: (edgeIndex: number, text: string) => void
  onVertexMarkUpsert: (armA: AngleArm, armB: AngleArm, color: string) => void
  onVertexMarkLabelChange: (armA: AngleArm, armB: AngleArm, text: string) => void
  onVertexMarkDelete: (armA: AngleArm, armB: AngleArm) => void
  onLineColorChange: (lineId: string, color: string) => void
  onLineLabelChange: (lineId: string, text: string) => void
  onLineDelete: (lineId: string) => void
  /** Persists the picked edge/line/angle into the zone's own customData so
   * it broadcasts to every call participant — see ZoneSelection's doc. */
  onSelectionChange: (target: ZoneSelection | null) => void
  onSelect: () => void
  onMoveTo: (x: number, y: number) => void
  onResizeTo: (width: number, height: number) => void
}

const PICK_THRESHOLD_PX = 8
const ANGLE_PICK_THRESHOLD_PX = 12
const ANGLE_VERTEX_PICK_PX = 22
const MIN_ZONE_SIZE = 60

function colorFor(edgeIndex: number, zone: ThreeDZone, isDark: boolean): THREE.Color {
  return new THREE.Color(themedColor(zone.edgeColors?.[edgeIndex] ?? zone.color, isDark))
}

function findVertexMark(marks: VertexMark[] | undefined, armA: AngleArm, armB: AngleArm): VertexMark | undefined {
  return marks?.find(m => (angleArmsEqual(m.armA, armA) && angleArmsEqual(m.armB, armB))
    || (angleArmsEqual(m.armA, armB) && angleArmsEqual(m.armB, armA)))
}

function buildConstructionGeometry(topology: EdgeTopology[], faces: FaceTopology[], lines: ConstructionLine[], isDark: boolean): { positions: number[]; colors: number[] } {
  const positions: number[] = []
  const colors: number[] = []
  for (const line of lines) {
    const p1 = resolveLocalSnapPoint(topology, faces, lines, line.startRef)
    const p2 = resolveLocalSnapPoint(topology, faces, lines, line.endRef)
    if (!p1 || !p2) continue
    const segPositions = buildDashDotPositions(p1, p2)
    positions.push(...segPositions)
    const c = new THREE.Color(themedColor(line.color, isDark))
    for (let i = 0; i < segPositions.length / 3; i++) colors.push(c.r, c.g, c.b)
  }
  return { positions, colors }
}

/** Angle-mark arcs: for each mark, finds the vertex its two arms (edges
 * and/or construction lines) share, builds a small arc between them in the
 * plane their two directions naturally span, and records the arc's middle
 * point (in `arcMidpoints`, keyed by mark.id) as the anchor used for
 * hit-testing/label placement, plus its two endpoints (in `arcEndpoints`)
 * and full point list (in `arcPoints`, used for the bold selection
 * highlight, which traces the arc rather than a straight chord). */
function buildAngleMarksGeometry(topology: EdgeTopology[], faces: FaceTopology[], lines: ConstructionLine[], marks: VertexMark[], isDark: boolean): { positions: number[]; colors: number[]; arcMidpoints: Map<string, THREE.Vector3>; arcEndpoints: Map<string, [THREE.Vector3, THREE.Vector3]>; arcPoints: Map<string, THREE.Vector3[]> } {
  const positions: number[] = []
  const colors: number[] = []
  const arcMidpoints = new Map<string, THREE.Vector3>()
  const arcEndpoints = new Map<string, [THREE.Vector3, THREE.Vector3]>()
  const arcPoints = new Map<string, THREE.Vector3[]>()
  for (const mark of marks) {
    const geometry = resolveAngleGeometry(topology, faces, lines, mark.armA, mark.armB)
    if (!geometry) continue
    const { vertex, dirA, dirB } = geometry
    const endsA = resolveArmEndpoints(topology, faces, lines, mark.armA)
    const endsB = resolveArmEndpoints(topology, faces, lines, mark.armB)
    const armLenA = endsA ? Math.max(endsA[0].distanceTo(vertex), endsA[1].distanceTo(vertex)) : 1
    const armLenB = endsB ? Math.max(endsB[0].distanceTo(vertex), endsB[1].distanceTo(vertex)) : 1
    const radius = Math.min(0.35, Math.max(0.08, Math.min(armLenA, armLenB) * 0.3))
    const points = buildAngleArcPoints(vertex, dirA, dirB, dirA.clone().cross(dirB), radius)
    if (points.length < 2) continue
    const c = new THREE.Color(themedColor(mark.color, isDark))
    for (let i = 0; i < points.length - 1; i++) {
      positions.push(points[i].x, points[i].y, points[i].z, points[i + 1].x, points[i + 1].y, points[i + 1].z)
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    arcMidpoints.set(mark.id, points[Math.floor(points.length / 2)])
    arcEndpoints.set(mark.id, [points[0], points[points.length - 1]])
    arcPoints.set(mark.id, points)
  }
  return { positions, colors, arcMidpoints, arcEndpoints, arcPoints }
}

type Picker = ZoneSelection

type EditingLabelTarget =
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'vertex'; armA: AngleArm; armB: AngleArm }
  | { kind: 'line'; lineId: string }

interface EditingLabel {
  target: EditingLabelTarget
  text: string
  clientX: number
  clientY: number
}

export function ThreeDZoneCanvas({ rect, zone, viewTransform, interactive, angleMode, onRotationCommit, onEdgeColorChange, onEdgeLabelChange, onVertexMarkUpsert, onVertexMarkLabelChange, onVertexMarkDelete, onLineColorChange, onLineLabelChange, onLineDelete, onSelectionChange, onSelect, onMoveTo, onResizeTo }: Props) {
  const { isDark } = useThemeCtx()
  const t = useTranslations('whiteboard.zoneCanvas')
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const solidLineRef = useRef<THREE.LineSegments | null>(null)
  const dashedLineRef = useRef<THREE.LineSegments | null>(null)
  const constructionLineRef = useRef<THREE.LineSegments | null>(null)
  const angleMarkLineRef = useRef<THREE.LineSegments | null>(null)
  const edgeTopologyRef = useRef<EdgeTopology[]>([])
  const faceTopologyRef = useRef<FaceTopology[]>([])
  const classifiedRef = useRef<ClassifiedEdge[]>([])
  const arcMidpointsRef = useRef<Map<string, THREE.Vector3>>(new Map())
  const arcEndpointsRef = useRef<Map<string, [THREE.Vector3, THREE.Vector3]>>(new Map())
  const arcPointsRef = useRef<Map<string, THREE.Vector3[]>>(new Map())
  const highlightPolylineRef = useRef<SVGPolylineElement>(null)
  const hoverPreviewPolylineRef = useRef<SVGPolylineElement>(null)
  const rotationRef = useRef({ x: zone.rotationX, y: zone.rotationY, z: zone.rotationZ })
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number }>({ active: false, moved: false, lastX: 0, lastY: 0 })
  const moveDragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null)
  const resizeDragRef = useRef<{ startClientX: number; startClientY: number; startWidth: number; startHeight: number } | null>(null)
  // Edge/angle-mark label DOM nodes — positioned imperatively (not via React
  // state) from updateVisualization so a live rotation drag moves them every
  // frame without a setState per frame. Labels stay upright (no CSS rotate)
  // so they're always legible regardless of the shape's current rotation;
  // only their (left, top) tracks the live projected anchor.
  const labelElRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const angleLabelElRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const lineLabelElRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // The zone's DOM box (.zone/.canvasHolder) is sized in CSS to rect.width/
  // height * zoom — the renderer/camera must render at that same pixel size
  // (not the unzoomed rect.width/height), otherwise three.js's own inline
  // canvas style fights the container size: the shape looked "too small" at
  // high zoom and "too big" at low zoom because the canvas was always
  // rendered at a fixed rect.width×rect.height regardless of zoom.
  const canvasWidth = rect.width * viewTransform.zoom
  const canvasHeight = rect.height * viewTransform.zoom

  const [picker, setPickerState] = useState<Picker | null>(null)
  const [editingLabel, setEditingLabel] = useState<EditingLabel | null>(null)
  // Angle-tool hover preview — the same picking as a click, but
  // non-committing and purely local (not synced — it's exactly what THIS
  // viewer is currently pointing at, not something to show other
  // participants); drives the semi-transparent bold arc preview.
  const [hoverAngleTarget, setHoverAngleTarget] = useState<{ armA: AngleArm; armB: AngleArm } | null>(null)

  // Drives both the local recolor popover (picker) and the shared
  // bold-highlight everyone in the call sees (onSelectionChange, persisted
  // into zone.customData) — every pick/deselect goes through this instead
  // of setPickerState directly so the two can never drift apart.
  const setPicker = useCallback((target: Picker | null) => {
    setPickerState(target)
    onSelectionChange(target)
  }, [onSelectionChange])

  // Delete/Backspace/Esc deletes the currently-selected line or angle mark —
  // edges are intrinsic to the shape (only recolorable, never deleted), so
  // this only fires for 'line'/'vertex' picks, matching the popover's own
  // delete button being shown only for those two kinds; Esc additionally
  // just deselects an edge pick (nothing to delete there, but it should
  // still clear on Esc same as any other selection). Ignored while typing
  // in the label input (that input closes the picker before it opens
  // anyway, but the DOM-focus check guards it defensively too).
  useEffect(() => {
    if (!picker) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (picker.kind === 'line') {
        onLineDelete(picker.lineId)
        setPicker(null)
      } else if (picker.kind === 'vertex') {
        onVertexMarkDelete(picker.armA, picker.armB)
        setPicker(null)
      } else if (e.key === 'Escape') {
        setPicker(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [picker, onLineDelete, onVertexMarkDelete, setPicker])

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
      const c = colorFor(index, zone, isDark)
      const target = edge.dashed ? dashedColors : solidColors
      target.push(c.r, c.g, c.b, c.r, c.g, c.b)
    })
    solidLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3))
    dashedLine.geometry.setAttribute('color', new THREE.Float32BufferAttribute(dashedColors, 3))
    render()
  }, [zone, isDark, render])

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
      for (const [markId, el] of angleLabelElRefs.current) {
        const mid = arcMidpointsRef.current.get(markId)
        if (!mid) continue
        const pos = projectPoint(mid, group, camera, canvasWidth, canvasHeight)
        el.style.left = `${pos.x}px`
        el.style.top = `${pos.y}px`
      }
      for (const [lineId, el] of lineLabelElRefs.current) {
        const line = zone.constructionLines?.find(l => l.id === lineId)
        if (!line) continue
        const p1 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], line.startRef)
        const p2 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], line.endRef)
        if (!p1 || !p2) continue
        const mid = p1.clone().add(p2).multiplyScalar(0.5)
        const pos = projectPoint(mid, group, camera, canvasWidth, canvasHeight)
        el.style.left = `${pos.x}px`
        el.style.top = `${pos.y}px`
      }

      // Bold highlight for whatever's currently selected — read from
      // zone.selection (synced through customData, so this renders
      // identically for every call participant, not just whoever clicked)
      // rather than the local `picker`, which only drives this participant's
      // own recolor popover. Angle marks highlight their full arc, not just
      // a chord between its two ends, so the bold stroke actually traces
      // the angle instead of cutting across it.
      const highlightEl = highlightPolylineRef.current
      if (highlightEl) {
        const selection = zone.selection
        let points: THREE.Vector3[] | null = null
        if (selection?.kind === 'edge') {
          const edge = classifiedRef.current[selection.edgeIndex]
          if (edge) points = [edge.v1, edge.v2]
        } else if (selection?.kind === 'line') {
          const line = zone.constructionLines?.find(l => l.id === selection.lineId)
          if (line) {
            const p1 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], line.startRef)
            const p2 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], line.endRef)
            if (p1 && p2) points = [p1, p2]
          }
        } else if (selection?.kind === 'vertex') {
          const mark = findVertexMark(zone.vertexMarks, selection.armA, selection.armB)
          if (mark) points = arcPointsRef.current.get(mark.id) ?? null
        }
        if (points && points.length >= 2) {
          const projected = points.map(p => projectPoint(p, group, camera, canvasWidth, canvasHeight))
          highlightEl.setAttribute('points', projected.map(p => `${p.x},${p.y}`).join(' '))
          highlightEl.style.display = ''
        } else {
          highlightEl.style.display = 'none'
        }
      }

      // Semi-transparent preview of where a click would place a NEW angle
      // mark, while the angle tool is hovering (not yet clicked) — purely
      // local, see hoverAngleTarget's own comment.
      const previewEl = hoverPreviewPolylineRef.current
      if (previewEl) {
        let previewPoints: THREE.Vector3[] | null = null
        if (hoverAngleTarget) {
          const lines = zone.constructionLines ?? []
          const geom = resolveAngleGeometry(edgeTopologyRef.current, faceTopologyRef.current, lines, hoverAngleTarget.armA, hoverAngleTarget.armB)
          if (geom) {
            const endsA = resolveArmEndpoints(edgeTopologyRef.current, faceTopologyRef.current, lines, hoverAngleTarget.armA)
            const endsB = resolveArmEndpoints(edgeTopologyRef.current, faceTopologyRef.current, lines, hoverAngleTarget.armB)
            const armLenA = endsA ? Math.max(endsA[0].distanceTo(geom.vertex), endsA[1].distanceTo(geom.vertex)) : 1
            const armLenB = endsB ? Math.max(endsB[0].distanceTo(geom.vertex), endsB[1].distanceTo(geom.vertex)) : 1
            const radius = Math.min(0.35, Math.max(0.08, Math.min(armLenA, armLenB) * 0.3))
            const points = buildAngleArcPoints(geom.vertex, geom.dirA, geom.dirB, geom.dirA.clone().cross(geom.dirB), radius)
            if (points.length >= 2) previewPoints = points
          }
        }
        if (previewPoints) {
          const projected = previewPoints.map(p => projectPoint(p, group, camera, canvasWidth, canvasHeight))
          previewEl.setAttribute('points', projected.map(p => `${p.x},${p.y}`).join(' '))
          previewEl.style.display = ''
        } else {
          previewEl.style.display = 'none'
        }
      }
    }

    applyColors()
  }, [applyColors, canvasWidth, canvasHeight, zone.constructionLines, zone.vertexMarks, zone.selection, hoverAngleTarget])

  // Selecting/deselecting (or hovering with the angle tool) doesn't itself
  // trigger a rotation frame or topology rebuild, so the highlight/preview
  // above needs its own nudge to appear (or disappear) immediately —
  // updateVisualization's own identity already changes with hoverAngleTarget
  // too (see its dependency array), so this re-fires for both.
  useEffect(() => {
    updateVisualization()
  }, [zone.selection, updateVisualization])

  // Scene setup once — container captured locally (see ThreeDPanel's note on
  // why: React 18 dev StrictMode mounts/cleans up/mounts this effect once to
  // catch exactly this class of bug).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = new THREE.Scene()
    const camera = createFramingCamera(canvasWidth, canvasHeight, zone.scale)
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
      angleMarkLineRef.current?.geometry.dispose()
      ;(angleMarkLineRef.current?.material as THREE.Material | undefined)?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      groupRef.current = null
      solidLineRef.current = null
      dashedLineRef.current = null
      constructionLineRef.current = null
      angleMarkLineRef.current = null
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
    const { positions, colors } = buildConstructionGeometry(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], isDark)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }))
    group.add(line)
    constructionLineRef.current = line
    render()
  }, [zone.primitive, zone.segments, zone.flat, zone.constructionLines, isDark, render])

  // Angle marks — small arcs between two arms (a shape edge and/or a
  // construction line) meeting at a shared point (see
  // buildAngleMarksGeometry). Same rotate-for-free pattern as construction
  // lines; also rebuilt when a construction line an arm references moves.
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    if (angleMarkLineRef.current) {
      group.remove(angleMarkLineRef.current)
      angleMarkLineRef.current.geometry.dispose()
      ;(angleMarkLineRef.current.material as THREE.Material).dispose()
    }
    const { positions, colors, arcMidpoints, arcEndpoints, arcPoints } = buildAngleMarksGeometry(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines ?? [], zone.vertexMarks ?? [], isDark)
    arcMidpointsRef.current = arcMidpoints
    arcEndpointsRef.current = arcEndpoints
    arcPointsRef.current = arcPoints
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }))
    group.add(line)
    angleMarkLineRef.current = line
    updateVisualization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.primitive, zone.segments, zone.flat, zone.constructionLines, zone.vertexMarks, isDark])

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

  // Camera backs off proportionally with scale (see BASE_CAMERA_DISTANCE's
  // comment on createFramingCamera) so a large zone.scale never clips the
  // shape against this canvas's own bounds.
  useEffect(() => {
    groupRef.current?.scale.setScalar(zone.scale)
    if (cameraRef.current) cameraRef.current.position.z = BASE_CAMERA_DISTANCE * Math.max(zone.scale, 0.1)
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
      const p1 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines, line.startRef)
      const p2 = resolveLocalSnapPoint(edgeTopologyRef.current, faceTopologyRef.current, zone.constructionLines, line.endRef)
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

  // Hit-tests EXISTING angle marks by their arc's midpoint — lets an already
  // -placed mark be recolored/deleted/labeled without re-entering angle
  // mode, same precedent as construction lines (creation needs the
  // dedicated mode/tool, editing an existing one doesn't).
  const pickAngleMark = useCallback((localX: number, localY: number): { mark: VertexMark; dist: number } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera || !zone.vertexMarks?.length) return null
    let best: { mark: VertexMark; dist: number } | null = null
    for (const mark of zone.vertexMarks) {
      const mid = arcMidpointsRef.current.get(mark.id)
      if (!mid) continue
      const p = projectPoint(mid, group, camera, canvasWidth, canvasHeight)
      const dist = Math.hypot(localX - p.x, localY - p.y)
      if (!best || dist < best.dist) best = { mark, dist }
    }
    return best && best.dist <= ANGLE_PICK_THRESHOLD_PX ? best : null
  }, [canvasWidth, canvasHeight, zone.vertexMarks])

  // Angle-mode picking, in two steps: find the junction (a point where 2+
  // arms — shape edges and/or construction lines — meet) nearest the
  // click, then pick whichever two of ITS arms point in the directions
  // closest to the click's own direction from that junction. Picking by
  // angle-from-junction, not by which arm's segment is nearest the click,
  // is what makes this symmetric between edges and construction lines: an
  // earlier "nearest arm, then a partner sharing its endpoint" version
  // structurally favored edges at any vertex where several converge (a
  // cube corner has 3) — with 3 candidate edges and only 1 line, some edge
  // was very often marginally closer to the click than the line even when
  // the user was clearly aiming between the line and an edge. Angle from
  // the junction doesn't have that bias: it only asks which wedge the
  // click fell into.
  const buildArmCandidates = useCallback((): { arm: AngleArm; p1: THREE.Vector3; p2: THREE.Vector3 }[] => {
    const topology = edgeTopologyRef.current
    const faces = faceTopologyRef.current
    const lines = zone.constructionLines ?? []
    const candidates: { arm: AngleArm; p1: THREE.Vector3; p2: THREE.Vector3 }[] = []
    topology.forEach((edge, edgeIndex) => candidates.push({ arm: { kind: 'edge', edgeIndex }, p1: edge.v1, p2: edge.v2 }))
    for (const line of lines) {
      const ends = resolveArmEndpoints(topology, faces, lines, { kind: 'line', lineId: line.id })
      if (ends) candidates.push({ arm: { kind: 'line', lineId: line.id }, p1: ends[0], p2: ends[1] })
    }
    return candidates
  }, [zone.constructionLines])

  const pickAngleTarget = useCallback((localX: number, localY: number): { armA: AngleArm; armB: AngleArm } | null => {
    const group = groupRef.current
    const camera = cameraRef.current
    if (!group || !camera) return null
    const arms = buildArmCandidates()
    if (arms.length === 0) return null

    // Every arm endpoint is a junction candidate — dedupe by 3D position
    // (an endpoint shared by several arms should only be considered once).
    const junctions: THREE.Vector3[] = []
    for (const arm of arms) {
      for (const p of [arm.p1, arm.p2]) {
        if (!junctions.some(j => j.distanceTo(p) < 0.01)) junctions.push(p)
      }
    }

    let nearestJunction: { point: THREE.Vector3; screen: { x: number; y: number }; dist: number } | null = null
    for (const j of junctions) {
      const screen = projectPoint(j, group, camera, canvasWidth, canvasHeight)
      const dist = Math.hypot(localX - screen.x, localY - screen.y)
      if (!nearestJunction || dist < nearestJunction.dist) nearestJunction = { point: j, screen, dist }
    }
    if (!nearestJunction || nearestJunction.dist > ANGLE_VERTEX_PICK_PX) return null

    // Every arm touching that junction, as a direction (screen angle,
    // pointing away from the junction toward its far end).
    const armsAtJunction = arms
      .map(arm => {
        const atP1 = arm.p1.distanceTo(nearestJunction!.point) < 0.01
        const atP2 = arm.p2.distanceTo(nearestJunction!.point) < 0.01
        if (!atP1 && !atP2) return null
        const farScreen = projectPoint(atP1 ? arm.p2 : arm.p1, group, camera, canvasWidth, canvasHeight)
        const angle = Math.atan2(farScreen.y - nearestJunction!.screen.y, farScreen.x - nearestJunction!.screen.x)
        return { arm: arm.arm, angle }
      })
      .filter((x): x is { arm: AngleArm; angle: number } => x !== null)
    if (armsAtJunction.length < 2) return null

    const clickAngle = Math.atan2(localY - nearestJunction.screen.y, localX - nearestJunction.screen.x)
    const angleDiff = (a: number, b: number) => {
      const d = Math.abs(a - b) % (Math.PI * 2)
      return d > Math.PI ? Math.PI * 2 - d : d
    }
    const byClosestDirection = [...armsAtJunction].sort((a, b) => angleDiff(a.angle, clickAngle) - angleDiff(b.angle, clickAngle))
    return { armA: byClosestDirection[0].arm, armB: byClosestDirection[1].arm }
  }, [buildArmCandidates, canvasWidth, canvasHeight])

  // Rotate is the default gesture on the shape body — no mode to enter first.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setPicker(null)
  }, [setPicker])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Angle-tool hover preview — only while idle (not mid rotate-drag), so
    // it doesn't fight the drag's own move handling below.
    if (angleMode && !dragRef.current.active) {
      const box = e.currentTarget.getBoundingClientRect()
      const target = pickAngleTarget(e.clientX - box.left, e.clientY - box.top)
      setHoverAngleTarget(prev => {
        if (prev === target) return prev
        if (prev && target && angleArmsEqual(prev.armA, target.armA) && angleArmsEqual(prev.armB, target.armB)) return prev
        return target
      })
    }
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
  }, [angleMode, pickAngleTarget, updateVisualization])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Also wired to onPointerLeave (so a rotate-drag still commits if the
    // cursor drifts off the canvas mid-drag) — but pointerleave fires for
    // any hover-away too, with no press involved. Without this guard, just
    // moving the mouse off the shape after a plain click re-ran the "plain
    // click" picking logic at the (now outside) cursor position, finding
    // nothing and silently closing whatever popover was open.
    if (e.type === 'pointerleave') setHoverAngleTarget(null)
    if (!dragRef.current.active) return
    const wasDragging = dragRef.current.moved
    dragRef.current.active = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}

    if (wasDragging) {
      onRotationCommit(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z)
      return
    }
    const box = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - box.left
    const localY = e.clientY - box.top

    // The "∠ Угол" tool takes over plain clicks entirely: pick whichever
    // two arms (edges and/or construction lines) sharing an endpoint are
    // closest to the click and create/select the angle mark there.
    if (angleMode) {
      const hit = pickAngleTarget(localX, localY)
      if (!hit) { setPicker(null); return }
      const existing = findVertexMark(zone.vertexMarks, hit.armA, hit.armB)
      onVertexMarkUpsert(hit.armA, hit.armB, existing?.color ?? zone.color)
      setPicker({ kind: 'vertex', armA: hit.armA, armB: hit.armB })
      return
    }

    // A plain click (no drag): pick whichever of an existing angle mark, a
    // construction line, or an edge is actually closest to the click, not a
    // fixed priority order — a median often runs close to a real edge in a
    // small/dense primitive, and a fixed priority made the loser
    // practically unselectable there.
    const edgeHit = pickEdge(localX, localY)
    const lineHit = pickConstructionLine(localX, localY)
    const angleHit = pickAngleMark(localX, localY)
    if (angleHit && (!lineHit || angleHit.dist <= lineHit.dist) && (!edgeHit || angleHit.dist <= edgeHit.dist)) {
      setPicker({ kind: 'vertex', armA: angleHit.mark.armA, armB: angleHit.mark.armB })
    } else if (lineHit && (!edgeHit || lineHit.dist <= edgeHit.dist)) {
      setPicker({ kind: 'line', lineId: lineHit.id })
    } else if (edgeHit) {
      setPicker({ kind: 'edge', edgeIndex: edgeHit.index })
    } else {
      setPicker(null)
    }
  }, [onRotationCommit, pickEdge, pickConstructionLine, pickAngleMark, angleMode, pickAngleTarget, onVertexMarkUpsert, zone.vertexMarks, zone.color, setPicker])

  // Double-click an edge, an angle mark, or a construction line to write an
  // arbitrary label on it (length, angle value, anything) — positioned
  // where the user clicked, like the recolor popup used to be, since this
  // one *is* a short-lived text-entry gesture tied to that exact spot
  // rather than a persistent menu. Works regardless of angleMode — double-
  // clicking a freshly-created mark (angle mode having just upserted it on
  // the matching single click) labels it in the same gesture. Whichever of
  // the three is actually closest to the click wins, same "closest, not
  // fixed priority" rule as the single-click picker below.
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - box.left
    const localY = e.clientY - box.top
    const angleHit = pickAngleMark(localX, localY)
    const lineHit = pickConstructionLine(localX, localY)
    const edgeHit = pickEdge(localX, localY)
    setPicker(null)

    const candidates: { dist: number; open: () => void }[] = []
    if (angleHit) {
      candidates.push({
        dist: angleHit.dist,
        open: () => setEditingLabel({
          target: { kind: 'vertex', armA: angleHit.mark.armA, armB: angleHit.mark.armB },
          text: angleHit.mark.label ?? '',
          clientX: e.clientX,
          clientY: e.clientY,
        }),
      })
    }
    if (lineHit) {
      candidates.push({
        dist: lineHit.dist,
        open: () => setEditingLabel({
          target: { kind: 'line', lineId: lineHit.id },
          text: zone.constructionLines?.find(l => l.id === lineHit.id)?.label ?? '',
          clientX: e.clientX,
          clientY: e.clientY,
        }),
      })
    }
    if (edgeHit) {
      candidates.push({
        dist: edgeHit.dist,
        open: () => setEditingLabel({ target: { kind: 'edge', edgeIndex: edgeHit.index }, text: zone.edgeLabels?.[edgeHit.index] ?? '', clientX: e.clientX, clientY: e.clientY }),
      })
    }
    candidates.sort((a, b) => a.dist - b.dist)
    candidates[0]?.open()
  }, [pickAngleMark, pickConstructionLine, pickEdge, zone.constructionLines, zone.edgeLabels, setPicker])

  const commitEditingLabel = useCallback(() => {
    if (!editingLabel) return
    const text = editingLabel.text.trim()
    if (editingLabel.target.kind === 'edge') onEdgeLabelChange(editingLabel.target.edgeIndex, text)
    else if (editingLabel.target.kind === 'line') onLineLabelChange(editingLabel.target.lineId, text)
    else onVertexMarkLabelChange(editingLabel.target.armA, editingLabel.target.armB, text)
    setEditingLabel(null)
  }, [editingLabel, onEdgeLabelChange, onLineLabelChange, onVertexMarkLabelChange])

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
          data-angle-mode={(interactive && angleMode) || undefined}
          onPointerDown={interactive ? handlePointerDown : undefined}
          onPointerMove={interactive ? handlePointerMove : undefined}
          onPointerUp={interactive ? handlePointerUp : undefined}
          onPointerLeave={interactive ? handlePointerUp : undefined}
          onDoubleClick={interactive ? handleDoubleClick : undefined}
        />
        <svg className={styles.highlightSvg} width={width} height={height}>
          <polyline ref={hoverPreviewPolylineRef} className={styles.hoverPreviewLine} style={{ display: 'none' }} fill="none" />
          <polyline ref={highlightPolylineRef} className={styles.highlightLine} style={{ display: 'none' }} fill="none" />
        </svg>
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
        {zone.vertexMarks?.filter(mark => mark.label).map(mark => (
          <div
            key={mark.id}
            ref={el => {
              if (el) angleLabelElRefs.current.set(mark.id, el)
              else angleLabelElRefs.current.delete(mark.id)
            }}
            className={styles.edgeLabel}
          >
            {mark.label}
          </div>
        ))}
        {zone.constructionLines?.filter(line => line.label).map(line => (
          <div
            key={line.id}
            ref={el => {
              if (el) lineLabelElRefs.current.set(line.id, el)
              else lineLabelElRefs.current.delete(line.id)
            }}
            className={styles.edgeLabel}
          >
            {line.label}
          </div>
        ))}
        <button
          type="button"
          className={styles.moveHandle}
          onPointerDown={handleMoveDown}
          onPointerMove={handleMoveMove}
          onPointerUp={handleMoveUp}
          title={t('moveHint')}
        >
          ✥
        </button>
        <button
          type="button"
          className={styles.resizeHandle}
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          title={t('resizeHint')}
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
                else if (picker.kind === 'vertex') onVertexMarkUpsert(picker.armA, picker.armB, swatch)
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
                else if (picker.kind === 'vertex') onVertexMarkDelete(picker.armA, picker.armB)
                setPicker(null)
              }}
              title={picker.kind === 'line' ? t('deleteLine') : t('deleteMark')}
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
          placeholder={editingLabel.target.kind === 'edge' ? t('edgeLabelPlaceholder') : editingLabel.target.kind === 'line' ? t('lineLabelPlaceholder') : t('angleLabelPlaceholder')}
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
