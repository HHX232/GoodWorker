import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ShapeId = 'cube' | 'pyramid' | 'cone' | 'cylinder' | 'sphere' | 'polygon'

export const PRIMITIVE_LABELS: Record<ShapeId, string> = {
  cube: 'Куб',
  pyramid: 'Пирамида',
  cone: 'Конус',
  cylinder: 'Цилиндр',
  sphere: 'Сфера',
  polygon: 'Многоугольник',
}

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
}

// Small, familiar whiteboard-marker set — reused by the formula and shape
// color pickers so both feel like the same tool.
export const INK_PALETTE = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#ececec', '#868e96']

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
  | { kind: 'centroid' }

export interface SnapCandidate extends Point {
  zoneElementId: string
  ref: SnapRef
}

export function snapRefsEqual(a: SnapRef, b: SnapRef): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'centroid') return true
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
