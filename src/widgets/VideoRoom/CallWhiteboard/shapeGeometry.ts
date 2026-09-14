import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

export type ShapeId = 'cube' | 'pyramid' | 'cone' | 'cylinder' | 'sphere'

export const PRIMITIVE_LABELS: Record<ShapeId, string> = {
  cube: 'Куб',
  pyramid: 'Пирамида',
  cone: 'Конус',
  cylinder: 'Цилиндр',
  sphere: 'Сфера',
}

export interface ThreeDShapeMeta {
  shapeId: string
  primitive: ShapeId
  rotationX: number
  rotationY: number
  scale: number
  color: string
  label?: string
}

export interface ProjectedEdge {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Self-occluded by the same (convex) shape at its current rotation. */
  dashed: boolean
}

export interface ThreeDInsertPayload {
  primitive: ShapeId
  rotationX: number
  rotationY: number
  scale: number
  color: string
  edges: ProjectedEdge[]
}

// Small, familiar whiteboard-marker set — reused by the formula and shape
// color pickers so both feel like the same tool.
export const INK_PALETTE = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#ececec', '#868e96']

export interface Point {
  x: number
  y: number
}

export interface ShapeEdge extends Point {
  elementId: string
  shapeId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

function readThreeDShape(element: ExcalidrawElement): ThreeDShapeMeta | undefined {
  return (element as unknown as { customData?: { threeDShape?: ThreeDShapeMeta } }).customData?.threeDShape
}

function readLinePoints(element: ExcalidrawElement): [number, number][] | undefined {
  return (element as unknown as { points?: [number, number][] }).points
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** All wireframe edges currently on the board, as absolute segments, grouped by shapeId. */
export function getShapeEdges(elements: readonly ExcalidrawElement[]): ShapeEdge[] {
  const edges: ShapeEdge[] = []
  for (const el of elements) {
    if (el.isDeleted || el.type !== 'line') continue
    const meta = readThreeDShape(el)
    const points = readLinePoints(el)
    if (!meta || !points || points.length < 2) continue
    const start = points[0]
    const end = points[points.length - 1]
    edges.push({
      elementId: el.id,
      shapeId: meta.shapeId,
      x1: el.x + start[0],
      y1: el.y + start[1],
      x2: el.x + end[0],
      y2: el.y + end[1],
      x: el.x + start[0],
      y: el.y + start[1],
    })
  }
  return edges
}

function dedupePoints(points: Point[], eps: number): Point[] {
  const out: Point[] = []
  for (const p of points) {
    if (!out.some(q => Math.hypot(q.x - p.x, q.y - p.y) < eps)) out.push(p)
  }
  return out
}

/** Snap candidates for the construction mode: vertices, edge midpoints and the
 * centroid of each wireframe shape on the board. */
export function getShapeSnapPoints(elements: readonly ExcalidrawElement[]): Point[] {
  const byShape = new Map<string, ShapeEdge[]>()
  for (const edge of getShapeEdges(elements)) {
    const arr = byShape.get(edge.shapeId) ?? []
    arr.push(edge)
    byShape.set(edge.shapeId, arr)
  }

  const points: Point[] = []
  for (const edges of byShape.values()) {
    const vertices: Point[] = []
    for (const edge of edges) {
      vertices.push({ x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 })
      points.push({ x: (edge.x1 + edge.x2) / 2, y: (edge.y1 + edge.y2) / 2 })
    }
    const unique = dedupePoints(vertices, 0.5)
    points.push(...unique)
    if (unique.length > 0) {
      points.push({
        x: unique.reduce((s, p) => s + p.x, 0) / unique.length,
        y: unique.reduce((s, p) => s + p.y, 0) / unique.length,
      })
    }
  }
  return points
}

export function findNearestEdge(point: Point, edges: ShapeEdge[], maxScreenDistance: number, zoom: number): ShapeEdge | null {
  let best: { edge: ShapeEdge; dist: number } | null = null
  for (const edge of edges) {
    const dist = distanceToSegment(point, { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 })
    if (!best || dist < best.dist) best = { edge, dist }
  }
  if (best && best.dist * zoom <= maxScreenDistance) return best.edge
  return null
}

export function boundsOfEdges(edges: ProjectedEdge[]): { minX: number; minY: number; width: number; height: number } {
  const xs = edges.flatMap(e => [e.x1, e.x2])
  const ys = edges.flatMap(e => [e.y1, e.y2])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

export function findNearestSnapPoint(point: Point, candidates: Point[], maxScreenDistance: number, zoom: number): Point | null {
  let best: { point: Point; dist: number } | null = null
  for (const candidate of candidates) {
    const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y)
    if (!best || dist < best.dist) best = { point: candidate, dist }
  }
  if (best && best.dist * zoom <= maxScreenDistance) return best.point
  return null
}
