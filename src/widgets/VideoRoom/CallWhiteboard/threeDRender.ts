// three.js-dependent geometry/rendering helpers, shared between the shape
// picker (ThreeDPanel, a small live preview before insert) and the live
// on-board renderer (ThreeDZoneCanvas, one per inserted zone). Kept out of
// shapeGeometry.ts on purpose: that module is imported statically from
// CallWhiteboard.tsx, and importing 'three' there would pull WebGL-touching
// code into the SSR bundle. Everything that needs this file is already
// mounted behind a `dynamic(..., { ssr: false })` boundary.
import * as THREE from 'three'
import { DEFAULT_SEGMENTS, rotateAroundCenter, type EdgeSegmentCandidate, type Point, type ShapeId, type SnapCandidate, type SnapRef, type ThreeDZone, type ZoneRect } from './shapeGeometry'

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

export interface FaceTopology {
  center: THREE.Vector3
  normal: THREE.Vector3
  /** Local-space positions of every vertex bounding this face — used to
   * test "does this face touch vertex V" by position match, and to resolve
   * an angle mark's corner (see findFaceEdgesAtVertex). */
  vertices: THREE.Vector3[]
  /** Source-geometry triangle indices belonging to this face — lets a
   * raycast hit (which reports a triangle index) be mapped back to its
   * face, for "which face did the user click" hit-testing. */
  triangleIndices: number[]
}

/**
 * Groups the geometry's source triangles into flat faces (a cube's side, a
 * pyramid's triangular face, a cone/cylinder's base cap, one segment of a
 * curved lateral surface) so "center of a face" can be a construction-line
 * snap point alongside vertices/edge-midpoints/solid-centroid. Two adjacent
 * triangles merge into the same face when they share an edge and their
 * normals agree within CREASE_ANGLE_THRESHOLD (the same test that decides a
 * visible "crease" edge) — union-find over triangle adjacency, so an N-gon
 * base fanned into N triangles from its center still merges into one face.
 */
export function buildFaceTopology(geometry: THREE.BufferGeometry): FaceTopology[] {
  const index = geometry.index
  const position = geometry.attributes.position
  if (!index) return []

  const indexArray = index.array
  const triCount = indexArray.length / 3

  const weldedId = new Map<string, number>()
  const weldedPosition = new Map<number, THREE.Vector3>()
  const weldOf = new Int32Array(position.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i)
    const key = `${v.x.toFixed(4)}_${v.y.toFixed(4)}_${v.z.toFixed(4)}`
    let id = weldedId.get(key)
    if (id === undefined) {
      id = weldedId.size
      weldedId.set(key, id)
      weldedPosition.set(id, v.clone())
    }
    weldOf[i] = id
  }

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const normals: THREE.Vector3[] = []
  const triVerts: [number, number, number][] = []
  for (let t = 0; t < triCount; t++) {
    const ia = indexArray[t * 3]
    const ib = indexArray[t * 3 + 1]
    const ic = indexArray[t * 3 + 2]
    vA.fromBufferAttribute(position, ia)
    vB.fromBufferAttribute(position, ib)
    vC.fromBufferAttribute(position, ic)
    normals.push(new THREE.Vector3().subVectors(vC, vB).cross(vA.clone().sub(vB)).normalize())
    triVerts.push([ia, ib, ic])
  }

  const edgeToTris = new Map<string, number[]>()
  for (let t = 0; t < triCount; t++) {
    const [ia, ib, ic] = triVerts[t]
    const corners: [number, number][] = [[ia, ib], [ib, ic], [ic, ia]]
    for (const [p, q] of corners) {
      const a = weldOf[p]
      const b = weldOf[q]
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      const entry = edgeToTris.get(key)
      if (entry) entry.push(t)
      else edgeToTris.set(key, [t])
    }
  }

  const parent = Array.from({ length: triCount }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (const tris of edgeToTris.values()) {
    for (let i = 1; i < tris.length; i++) {
      if (normals[tris[0]].angleTo(normals[tris[i]]) <= CREASE_ANGLE_THRESHOLD) union(tris[0], tris[i])
    }
  }

  const groups = new Map<number, number[]>()
  for (let t = 0; t < triCount; t++) {
    const root = find(t)
    const g = groups.get(root)
    if (g) g.push(t)
    else groups.set(root, [t])
  }

  const faces: FaceTopology[] = []
  for (const tris of groups.values()) {
    const vertIds = new Set<number>()
    const normalSum = new THREE.Vector3()
    for (const t of tris) {
      for (const vi of triVerts[t]) vertIds.add(weldOf[vi])
      normalSum.add(normals[t])
    }
    const center = new THREE.Vector3()
    for (const id of vertIds) center.add(weldedPosition.get(id)!)
    center.multiplyScalar(1 / vertIds.size)
    const vertices = Array.from(vertIds, id => weldedPosition.get(id)!)
    faces.push({ center, normal: normalSum.normalize(), vertices, triangleIndices: tris })
  }
  return faces
}

/**
 * Given a face and a vertex on its boundary, finds the two edges (indices
 * into `topology`) that meet at that vertex WITHIN this face — the pair an
 * angle mark's arc spans. Only edges with BOTH endpoints among the face's
 * own vertices qualify, which is what excludes a vertex's other edges that
 * belong to a different face (e.g. a cone's rim vertex also has an edge up
 * to the apex, on the lateral face, not the base). Internal "spoke" edges
 * of a triangulated N-gon face never appear in `topology` to begin with —
 * two triangles fanned from the same coplanar face have a 0° angle between
 * their normals, so buildEdgeTopology's crease test already drops them.
 */
export function findFaceEdgesAtVertex(topology: EdgeTopology[], face: FaceTopology, vertexPos: THREE.Vector3, epsilon = 0.01): [number, number] | null {
  const touching: number[] = []
  for (let i = 0; i < topology.length; i++) {
    const edge = topology[i]
    const touchesV1 = edge.v1.distanceTo(vertexPos) < epsilon
    const touchesV2 = edge.v2.distanceTo(vertexPos) < epsilon
    if (!touchesV1 && !touchesV2) continue
    const other = touchesV1 ? edge.v2 : edge.v1
    if (face.vertices.some(fv => fv.distanceTo(other) < epsilon)) touching.push(i)
  }
  return touching.length >= 2 ? [touching[0], touching[1]] : null
}

/** Points (vertex → …→ vertex, A-to-B ordered) tracing a small angle-mark
 * arc: from `dirA` curving toward `dirB` (both unit vectors from `vertex`,
 * both lying in the face's plane) around `axis` (the face normal), at
 * `radius`. The caller turns consecutive points into LineSegments position
 * pairs, and can also read off e.g. the middle point as the arc's anchor
 * for hit-testing/label placement. */
export function buildAngleArcPoints(vertex: THREE.Vector3, dirA: THREE.Vector3, dirB: THREE.Vector3, axis: THREE.Vector3, radius: number, segments = 10): THREE.Vector3[] {
  const angle = dirA.angleTo(dirB)
  if (angle < 1e-4) return []
  // Right-hand rule: rotating dirA by +angle around (dirA × dirB) lands
  // exactly on dirB. `axis` (the face normal) may point either way relative
  // to that, so match its sign via the dot product rather than guessing.
  const cross = dirA.clone().cross(dirB)
  const sign = cross.dot(axis) >= 0 ? 1 : -1
  const points: THREE.Vector3[] = [vertex.clone().addScaledVector(dirA, radius)]
  for (let i = 1; i <= segments; i++) {
    const t = (i / segments) * angle * sign
    const dir = dirA.clone().applyAxisAngle(axis, t)
    points.push(vertex.clone().addScaledVector(dir, radius))
  }
  return points
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

/** Projects a zone-local (unrotated-3D) point to its absolute scene position
 * — accounts for the zone's current 3D rotation/scale and its on-board
 * position/rotation (`rect.angle`, from the native Excalidraw rotate
 * handle). Shared by every function below that needs to place a local point
 * (vertex, face center, arbitrary edge point, …) on the board. */
function buildZoneProjector(zone: ThreeDZone, rect: ZoneRect): (local: THREE.Vector3) => Point {
  const group = new THREE.Group()
  group.rotation.set(zone.rotationX, zone.rotationY, zone.rotationZ)
  group.scale.setScalar(zone.scale)
  group.updateMatrixWorld(true)
  const camera = createFramingCamera(rect.width, rect.height)
  camera.updateMatrixWorld(true)

  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  return (local: THREE.Vector3): Point => {
    const p = projectPoint(local, group, camera, rect.width, rect.height)
    return rotateAroundCenter({ x: rect.x + p.x, y: rect.y + p.y }, center, rect.angle)
  }
}

/** Every construction-mode snap point (vertex/midpoint/centroid) for one
 * zone, in absolute scene coordinates. Rebuilds geometry+topology on every
 * call; only meant for infrequent triggers (construction mode toggling on,
 * a zone's config changing), not a per-frame hot path. */
export function computeZoneSnapCandidates(elementId: string, zone: ThreeDZone, rect: ZoneRect): SnapCandidate[] {
  const geometry = buildGeometry(zone.primitive, zone.segments ?? DEFAULT_SEGMENTS[zone.primitive], zone.flat ?? false)
  const topology = buildEdgeTopology(geometry)
  const faces = buildFaceTopology(geometry)
  geometry.dispose()
  const { vertices, midpoints, centroid } = getLocalSnapPoints(topology)
  const toScene = buildZoneProjector(zone, rect)

  const candidates: SnapCandidate[] = []
  vertices.forEach((v, index) => candidates.push({ ...toScene(v), zoneElementId: elementId, ref: { kind: 'vertex', index } }))
  midpoints.forEach((v, index) => candidates.push({ ...toScene(v), zoneElementId: elementId, ref: { kind: 'midpoint', index } }))
  faces.forEach((f, index) => candidates.push({ ...toScene(f.center), zoneElementId: elementId, ref: { kind: 'faceCenter', index } }))
  if (centroid) candidates.push({ ...toScene(centroid), zoneElementId: elementId, ref: { kind: 'centroid' } })
  return candidates
}

/** Every edge of one zone, as a segment in absolute scene coordinates —
 * lets a construction-line endpoint snap to any point along an edge (not
 * just its discrete vertex/midpoint), via projection onto the segment. */
export function computeZoneEdgeSegments(elementId: string, zone: ThreeDZone, rect: ZoneRect): EdgeSegmentCandidate[] {
  const geometry = buildGeometry(zone.primitive, zone.segments ?? DEFAULT_SEGMENTS[zone.primitive], zone.flat ?? false)
  const topology = buildEdgeTopology(geometry)
  geometry.dispose()
  const toScene = buildZoneProjector(zone, rect)
  return topology.map((edge, edgeIndex) => ({
    zoneElementId: elementId,
    edgeIndex,
    a: toScene(edge.v1),
    b: toScene(edge.v2),
  }))
}

/** Resolve one specific snap ref (e.g. "vertex 2") to its current absolute
 * scene position — used to re-anchor a construction line bound to this zone
 * after the zone's rotation/primitive/etc. changes. `edgePoint` is resolved
 * directly (interpolated along the edge) rather than searched for in the
 * discrete candidate list, since its `t` isn't one of a finite set. */
export function resolveSnapRef(elementId: string, zone: ThreeDZone, rect: ZoneRect, ref: SnapRef): Point | null {
  if (ref.kind === 'edgePoint') {
    const geometry = buildGeometry(zone.primitive, zone.segments ?? DEFAULT_SEGMENTS[zone.primitive], zone.flat ?? false)
    const topology = buildEdgeTopology(geometry)
    geometry.dispose()
    const edge = topology[ref.edgeIndex]
    if (!edge) return null
    return buildZoneProjector(zone, rect)(edge.v1.clone().lerp(edge.v2, ref.t))
  }
  const candidates = computeZoneSnapCandidates(elementId, zone, rect)
  return candidates.find(c => c.ref.kind === ref.kind && (ref.kind === 'centroid' || (c.ref as { index: number }).index === (ref as { index: number }).index)) ?? null
}

/** Resolve a snap ref against an already-built topology's local points —
 * used inside a zone's own live scene (construction lines embedded in it),
 * where the topology is already sitting in a ref and rebuilding it from
 * scratch on every rotation frame would be wasteful. */
export function resolveLocalSnapPoint(topology: EdgeTopology[], faces: FaceTopology[], ref: SnapRef): THREE.Vector3 | null {
  if (ref.kind === 'faceCenter') return faces[ref.index]?.center ?? null
  if (ref.kind === 'edgePoint') {
    const edge = topology[ref.edgeIndex]
    return edge ? edge.v1.clone().lerp(edge.v2, ref.t) : null
  }
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
