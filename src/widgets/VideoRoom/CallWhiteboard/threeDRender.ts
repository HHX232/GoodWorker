// three.js-dependent geometry/rendering helpers, shared between the shape
// picker (ThreeDPanel, a small live preview before insert) and the live
// on-board renderer (ThreeDZoneCanvas, one per inserted zone). Kept out of
// shapeGeometry.ts on purpose: that module is imported statically from
// CallWhiteboard.tsx, and importing 'three' there would pull WebGL-touching
// code into the SSR bundle. Everything that needs this file is already
// mounted behind a `dynamic(..., { ssr: false })` boundary.
import * as THREE from 'three'
import { DEFAULT_SEGMENTS, rotateAroundCenter, type Point, type ShapeId, type SnapCandidate, type SnapRef, type ThreeDZone, type ZoneRect } from './shapeGeometry'

export const CREASE_ANGLE_THRESHOLD = THREE.MathUtils.degToRad(1)
// A shape's own surface is what can hide part of its own edges (no other
// objects share this scene) — so classification only answers "does the
// shape's near side block this edge", not a full multi-object depth test.
const VIEW_DIR = new THREE.Vector3(0, 0, 1)

export function buildGeometry(primitive: ShapeId, segments: number, flat: boolean): THREE.BufferGeometry {
  switch (primitive) {
    case 'cube':
      return new THREE.BoxGeometry(1.5, 1.5, 1.5)
    case 'pyramid':
      return new THREE.ConeGeometry(1.1, 1.7, 4)
    case 'cone':
      return new THREE.ConeGeometry(1.1, 1.7, segments)
    case 'cylinder':
      return new THREE.CylinderGeometry(0.9, 0.9, 1.6, segments)
    case 'sphere':
      return new THREE.SphereGeometry(1.1, segments, Math.max(3, Math.round(segments * 0.65)))
    case 'polygon':
      return flat
        ? new THREE.CircleGeometry(1.2, segments)
        : new THREE.CylinderGeometry(1, 1, 1.4, segments)
  }
}

export interface EdgeTopology {
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
 *
 * A flat polygon (CircleGeometry) is a degenerate case: every triangle
 * shares the same normal, so the angle-threshold test below drops all the
 * "spoke" edges between them — only the boundary (rim) edges, which by
 * definition have just one adjacent triangle, survive. Those default to
 * always-visible, which is physically right for a zero-thickness shape:
 * there's no volume behind it to hide its own outline.
 */
export function buildEdgeTopology(geometry: THREE.BufferGeometry): EdgeTopology[] {
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

export interface ClassifiedEdge {
  v1: THREE.Vector3
  v2: THREE.Vector3
  dashed: boolean
}

export function classifyEdges(topology: EdgeTopology[], rotationX: number, rotationY: number, rotationZ: number): ClassifiedEdge[] {
  const euler = new THREE.Euler(rotationX, rotationY, rotationZ)
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

/** Split classified edges into flat position arrays ready for two
 * THREE.BufferGeometry (solid / dashed), in local (group) space. */
export function splitSolidDashedPositions(classified: ClassifiedEdge[]): { solid: number[]; dashed: number[] } {
  const solid: number[] = []
  const dashed: number[] = []
  for (const edge of classified) {
    const target = edge.dashed ? dashed : solid
    target.push(edge.v1.x, edge.v1.y, edge.v1.z, edge.v2.x, edge.v2.y, edge.v2.z)
  }
  return { solid, dashed }
}

/** A fresh camera framing the shape consistently regardless of the target
 * rect's aspect ratio — vertical FOV fixed, `aspect` (set from rectW/rectH)
 * handles the rest, same convention `PerspectiveCamera` already uses. */
export function createFramingCamera(rectWidth: number, rectHeight: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(40, Math.max(rectWidth, 1) / Math.max(rectHeight, 1), 0.1, 100)
  camera.position.set(0, 0, 4.6)
  camera.lookAt(0, 0, 0)
  return camera
}

export interface Point2D {
  x: number
  y: number
}

/** Projects a local-space point through `group`'s current transform and the
 * camera into pixel coordinates of a `rectWidth`×`rectHeight` box. */
export function projectPoint(local: THREE.Vector3, group: THREE.Object3D, camera: THREE.PerspectiveCamera, rectWidth: number, rectHeight: number): Point2D {
  const p = local.clone().applyMatrix4(group.matrixWorld).project(camera)
  return {
    x: (p.x * 0.5 + 0.5) * rectWidth,
    y: (1 - (p.y * 0.5 + 0.5)) * rectHeight,
  }
}

function dedupeVectors(points: THREE.Vector3[], eps: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (const p of points) {
    if (!out.some(q => q.distanceTo(p) < eps)) out.push(p)
  }
  return out
}

export interface LocalSnapPoints {
  vertices: THREE.Vector3[]
  /** Indexed by edge order within the topology — matches the edge index
   * baked into inserted/edited zones' `edgeColors` keys too. */
  midpoints: THREE.Vector3[]
  centroid: THREE.Vector3 | null
}

/** Rotation-independent — vertices/midpoints/centroid in the shape's own
 * local space, computed once per primitive/segments/flat. */
export function getLocalSnapPoints(topology: EdgeTopology[]): LocalSnapPoints {
  const allVerts: THREE.Vector3[] = []
  const midpoints: THREE.Vector3[] = []
  for (const edge of topology) {
    allVerts.push(edge.v1, edge.v2)
    midpoints.push(edge.v1.clone().add(edge.v2).multiplyScalar(0.5))
  }
  const vertices = dedupeVectors(allVerts, 0.01)
  let centroid: THREE.Vector3 | null = null
  if (vertices.length > 0) {
    centroid = vertices.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / vertices.length)
  }
  return { vertices, midpoints, centroid }
}

/** Every construction-mode snap point (vertex/midpoint/centroid) for one
 * zone, in absolute scene coordinates — accounts for the zone's current
 * rotation/scale (3D) and its on-board position/rotation (2D, `rect.angle`
 * from the native Excalidraw rotate handle). Rebuilds geometry+topology on
 * every call; only meant for infrequent triggers (construction mode toggling
 * on, a zone's config changing), not a per-frame hot path. */
export function computeZoneSnapCandidates(elementId: string, zone: ThreeDZone, rect: ZoneRect): SnapCandidate[] {
  const geometry = buildGeometry(zone.primitive, zone.segments ?? DEFAULT_SEGMENTS[zone.primitive], zone.flat ?? false)
  const topology = buildEdgeTopology(geometry)
  geometry.dispose()
  const { vertices, midpoints, centroid } = getLocalSnapPoints(topology)

  const group = new THREE.Group()
  group.rotation.set(zone.rotationX, zone.rotationY, zone.rotationZ)
  group.scale.setScalar(zone.scale)
  group.updateMatrixWorld(true)
  const camera = createFramingCamera(rect.width, rect.height)
  camera.updateMatrixWorld(true)

  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const toScene = (local: THREE.Vector3): Point => {
    const p = projectPoint(local, group, camera, rect.width, rect.height)
    return rotateAroundCenter({ x: rect.x + p.x, y: rect.y + p.y }, center, rect.angle)
  }

  const candidates: SnapCandidate[] = []
  vertices.forEach((v, index) => candidates.push({ ...toScene(v), zoneElementId: elementId, ref: { kind: 'vertex', index } }))
  midpoints.forEach((v, index) => candidates.push({ ...toScene(v), zoneElementId: elementId, ref: { kind: 'midpoint', index } }))
  if (centroid) candidates.push({ ...toScene(centroid), zoneElementId: elementId, ref: { kind: 'centroid' } })
  return candidates
}

/** Resolve one specific snap ref (e.g. "vertex 2") to its current absolute
 * scene position — used to re-anchor a construction line bound to this zone
 * after the zone's rotation/primitive/etc. changes. */
export function resolveSnapRef(elementId: string, zone: ThreeDZone, rect: ZoneRect, ref: SnapRef): Point | null {
  const candidates = computeZoneSnapCandidates(elementId, zone, rect)
  return candidates.find(c => c.ref.kind === ref.kind && (ref.kind === 'centroid' || (c.ref as { index: number }).index === (ref as { index: number }).index)) ?? null
}

/** Resolve a snap ref against an already-built topology's local points —
 * used inside a zone's own live scene (construction lines embedded in it),
 * where the topology is already sitting in a ref and rebuilding it from
 * scratch on every rotation frame would be wasteful. */
export function resolveLocalSnapPoint(topology: EdgeTopology[], ref: SnapRef): THREE.Vector3 | null {
  const { vertices, midpoints, centroid } = getLocalSnapPoints(topology)
  if (ref.kind === 'vertex') return vertices[ref.index] ?? null
  if (ref.kind === 'midpoint') return midpoints[ref.index] ?? null
  return centroid
}

/** Positions for a dash-dot line from `p1` to `p2` (technical-drawing
 * convention for medians/axes/symmetry lines) — three.js's own dashed
 * material only repeats one uniform dash+gap, so this builds the
 * dash/gap/dot/gap pattern by hand as a series of short disconnected
 * segments for a plain LineSegments geometry. */
export function buildDashDotPositions(p1: THREE.Vector3, p2: THREE.Vector3, dashLen = 0.12, dotLen = 0.02, gapLen = 0.06): number[] {
  const dir = p2.clone().sub(p1)
  const totalLen = dir.length()
  if (totalLen < 1e-6) return []
  dir.normalize()
  const positions: number[] = []
  let t = 0
  let isDash = true
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  while (t < totalLen) {
    const segLen = isDash ? dashLen : dotLen
    const segEnd = Math.min(t + segLen, totalLen)
    a.copy(p1).addScaledVector(dir, t)
    b.copy(p1).addScaledVector(dir, segEnd)
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    t = segEnd + gapLen
    isDash = !isDash
  }
  return positions
}
