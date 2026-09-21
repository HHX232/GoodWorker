import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ShapeId = 'cube' | 'pyramid' | 'cone' | 'cylinder' | 'sphere' | 'polygon'

// Primitives whose facet/side count is user-adjustable ("visible edges" for
// the round ones; the defining N for the polygon).
export const SEGMENT_ADJUSTABLE: ReadonlySet<ShapeId> = new Set(['cone', 'cylinder', 'sphere', 'polygon'])
export const DEFAULT_SEGMENTS: Record<ShapeId, number> = {
  cube: 0,
  pyramid: 0,
  cone: 24,
  cylinder: 20,
  sphere: 16,
  polygon: 6,
}

export interface ThreeDShapeMeta {
  primitive: ShapeId
  rotationX: number
  rotationY: number
  rotationZ: number
  scale: number
  color: string
  label?: string
  /** Facet/side count for cone/cylinder/sphere/polygon; unused otherwise. */
  segments?: number
  /** Polygon only: flat 2D outline instead of an extruded 3D prism. */
  flat?: boolean
}

/** What's stored in a zone rectangle's `customData.threeDZone` — the shape
 * config plus per-edge color overrides painted in on-board 3D mode. There's
 * no separate "shapeId" — the zone IS one Excalidraw element, so its own
 * `element.id` is the identity. */
export interface ThreeDZone extends ThreeDShapeMeta {
  /** Edge index (stable within a given primitive/segments/flat — see
   * buildEdgeTopology's iteration order) → color override. */
  edgeColors?: Record<number, string>
  /** Medians/bisectors/etc. drawn fully inside this shape — see ConstructionLine. */
  constructionLines?: ConstructionLine[]
  /** Edge index → arbitrary label text (e.g. a length/angle annotation),
   * set via double-click on the edge. Rendered upright at the edge's live
   * projected midpoint — see the note in ThreeDZoneCanvas on why the text
   * itself doesn't tilt with the 3D rotation. */
  edgeLabels?: Record<number, string>
  /** Angle marks — small arcs between two "arms" (a shape edge and/or a
   * construction line) that share an endpoint (see VertexMark). Created
   * with the dedicated "∠ Угол" tool. */
  vertexMarks?: VertexMark[]
  /** Which edge/line/angle is currently picked — synced through the same
   * customData broadcast as everything else so a single click highlights
   * that edge/line/angle bold for EVERY call participant, not just locally
   * (useful for a teacher pointing something out to a student). Recoloring
   * still uses its own local popover state; this only drives the shared
   * highlight overlay. */
  selection?: ZoneSelection | null
}

export type ZoneSelection =
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'line'; lineId: string }
  | { kind: 'vertex'; armA: AngleArm; armB: AngleArm }

/** One side of an angle mark — either the shape's own edge, or a
 * user-drawn construction line. Whichever endpoint the two arms of a
 * VertexMark have in common (within a small tolerance) is the angle's
 * vertex; the arc's plane is derived from the two arms' own directions,
 * not a pre-existing face, so this works equally for two shape edges, two
 * construction lines, or one of each. */
export type AngleArm =
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'line'; lineId: string }

export function angleArmsEqual(a: AngleArm, b: AngleArm): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'edge' ? a.edgeIndex === (b as { edgeIndex: number }).edgeIndex : a.lineId === (b as { lineId: string }).lineId
}

/** One angle mark: the arc spans from `armA` to `armB` at the vertex those
 * two arms share. The (armA, armB) pair is the mark's real identity
 * (order-independent) — `id` only exists for a stable React key,
 * operations (recolor/label/delete) match by the pair so a freshly-created
 * mark can be addressed before its mutateElement round-trip lands. */
export interface VertexMark {
  id: string
  armA: AngleArm
  armB: AngleArm
  color: string
  label?: string
}

// Small, familiar whiteboard-marker set — reused by the formula and shape
// color pickers so both feel like the same tool.
export const INK_PALETTE = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#ececec', '#868e96']

/** The palette's two "ink"/"paper" ends only make sense relative to the
 * CURRENT board background, not as fixed colors — a shape's default black
 * edges (picked while the board was light) go nearly invisible if the call
 * later switches to dark theme, since nothing about a saved zone re-derives
 * its color from the live theme on its own. Used at render time everywhere
 * a zone's stored color reaches the screen (edges, construction lines,
 * angle marks) so old and new shapes alike stay legible in both themes,
 * without silently overriding any OTHER explicitly-picked palette color. */
export function themedColor(color: string, isDark: boolean): string {
  if (isDark && color.toLowerCase() === '#1e1e1e') return '#ececec'
  if (!isDark && color.toLowerCase() === '#ececec') return '#1e1e1e'
  return color
}

export interface Point {
  x: number
  y: number
}

export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

export function readThreeDZone(element: ExcalidrawElement): ThreeDZone | undefined {
  return (element as unknown as { customData?: { threeDZone?: ThreeDZone } }).customData?.threeDZone
}

export function getZoneRect(element: ExcalidrawElement): ZoneRect {
  return { x: element.x, y: element.y, width: element.width, height: element.height, angle: element.angle }
}

/** All zone (rectangle) elements currently on the board, paired with their
 * parsed config. */
export function getAllZones(elements: readonly ExcalidrawElement[]): { element: ExcalidrawElement; zone: ThreeDZone; rect: ZoneRect }[] {
  const result: { element: ExcalidrawElement; zone: ThreeDZone; rect: ZoneRect }[] = []
  for (const el of elements) {
    if (el.isDeleted || el.type !== 'rectangle') continue
    const zone = readThreeDZone(el)
    if (!zone) continue
    result.push({ element: el, zone, rect: getZoneRect(el) })
  }
  return result
}

/** Excalidraw rotates every element in place around its own bounding-box
 * center (`x + width/2`, `y + height/2`) by `element.angle`. Used to turn a
 * point expressed in a zone's own unrotated local frame into an absolute
 * scene point (or back, with `-angle`). */
export function rotateAroundCenter(point: Point, center: Point, angle: number): Point {
  if (angle === 0) return point
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export type SnapRef =
  | { kind: 'vertex'; index: number }
  | { kind: 'midpoint'; index: number }
  /** Center of a flat face — a cube's side, a pyramid's triangular face, a
   * cone/cylinder's base cap. Lets a construction line be a "plane"/side
   * median instead of only vertex/edge-midpoint/solid-centroid. */
  | { kind: 'faceCenter'; index: number }
  /** An arbitrary point along one edge, not just its endpoints/midpoint —
   * `t` (0..1) is the position from the edge's v1 to v2. Lets a line end
   * "slide" anywhere along an edge and still stay glued to it (re-resolved
   * from edgeIndex+t) after the shape rotates, moves, or is resized. */
  | { kind: 'edgePoint'; edgeIndex: number; t: number }
  /** An arbitrary point along an EXISTING construction line (`t` 0..1, from
   * its startRef to endRef) — lets one construction line be built starting
   * or ending on another one, the same "slide anywhere, not just the
   * endpoints" idea as edgePoint but for user-drawn lines instead of the
   * shape's own edges. Resolved recursively (the referenced line's own
   * endpoints can themselves be a vertex/edgePoint/linePoint/…), so chains
   * of constructions-on-constructions work; see resolveLocalSnapPoint's
   * depth guard against cycles. */
  | { kind: 'linePoint'; lineId: string; t: number }
  | { kind: 'centroid' }

export interface SnapCandidate extends Point {
  zoneElementId: string
  ref: SnapRef
}

/** One shape edge in absolute scene coordinates — used to snap a
 * construction-line endpoint to any point along the edge (not just its
 * discrete vertex/midpoint candidates), via projection onto the segment. */
export interface EdgeSegmentCandidate {
  zoneElementId: string
  edgeIndex: number
  a: Point
  b: Point
}

/** One EXISTING construction line in absolute scene coordinates — the same
 * idea as EdgeSegmentCandidate but for user-drawn lines, so a new line can
 * snap onto/slide along an already-drawn one. */
export interface LineSegmentCandidate {
  zoneElementId: string
  lineId: string
  a: Point
  b: Point
}

export function snapRefsEqual(a: SnapRef, b: SnapRef): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'centroid') return true
  if (a.kind === 'edgePoint') return a.edgeIndex === (b as { edgeIndex: number }).edgeIndex && Math.abs(a.t - (b as { t: number }).t) < 1e-6
  if (a.kind === 'linePoint') return a.lineId === (b as { lineId: string }).lineId && Math.abs(a.t - (b as { t: number }).t) < 1e-6
  return a.index === (b as { index: number }).index
}

/** A median/bisector/diagonal drawn with both ends snapped inside the same
 * shape — lives entirely in that zone's own three.js scene (as a child of
 * the same rotating/scaling group the shape's edges are in) instead of as a
 * separate Excalidraw element, so it rotates and zooms with the shape for
 * free with no rebind step. A line that leaves the shape's bounds stays the
 * old way — a plain Excalidraw `line` bound via `customData.boundTo`. */
export interface ConstructionLine {
  id: string
  startRef: SnapRef
  endRef: SnapRef
  color: string
  /** Arbitrary label text (e.g. a length), set via double-click on the
   * line — same mechanism as edge/angle-mark labels. */
  label?: string
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function findNearestSnapPoint(point: Point, candidates: SnapCandidate[], maxScreenDistance: number, zoom: number): SnapCandidate | null {
  let best: { point: SnapCandidate; dist: number } | null = null
  for (const candidate of candidates) {
    const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y)
    if (!best || dist < best.dist) best = { point: candidate, dist }
  }
  if (best && best.dist * zoom <= maxScreenDistance) return best.point
  return null
}

/** Nearest point on segment a→b to p, plus how far along the segment it is
 * (t, 0..1) and the distance from p to that projected point. */
export function projectPointToSegment(p: Point, a: Point, b: Point): { point: Point; t: number; dist: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return { point: a, t: 0, dist: Math.hypot(p.x - a.x, p.y - a.y) }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  const point = { x: a.x + t * dx, y: a.y + t * dy }
  return { point, t, dist: Math.hypot(p.x - point.x, p.y - point.y) }
}

/** Like findNearestSnapPoint but for landing anywhere along an edge, not
 * just its discrete vertex/midpoint — the "slide along the rest of the
 * edge" half of construction-line snapping. */
export function findNearestEdgePoint(point: Point, segments: EdgeSegmentCandidate[], maxScreenDistance: number, zoom: number): SnapCandidate | null {
  let best: { candidate: SnapCandidate; dist: number } | null = null
  for (const seg of segments) {
    const { point: proj, t, dist } = projectPointToSegment(point, seg.a, seg.b)
    if (!best || dist < best.dist) {
      best = { candidate: { x: proj.x, y: proj.y, zoneElementId: seg.zoneElementId, ref: { kind: 'edgePoint', edgeIndex: seg.edgeIndex, t } }, dist }
    }
  }
  if (best && best.dist * zoom <= maxScreenDistance) return best.candidate
  return null
}

/** Like findNearestEdgePoint but for sliding along an EXISTING construction
 * line instead of a shape edge — the "connect constructions to each other"
 * half of the snap system. */
export function findNearestLinePoint(point: Point, segments: LineSegmentCandidate[], maxScreenDistance: number, zoom: number): SnapCandidate | null {
  let best: { candidate: SnapCandidate; dist: number } | null = null
  for (const seg of segments) {
    const { point: proj, t, dist } = projectPointToSegment(point, seg.a, seg.b)
    if (!best || dist < best.dist) {
      best = { candidate: { x: proj.x, y: proj.y, zoneElementId: seg.zoneElementId, ref: { kind: 'linePoint', lineId: seg.lineId, t } }, dist }
    }
  }
  if (best && best.dist * zoom <= maxScreenDistance) return best.candidate
  return null
}
