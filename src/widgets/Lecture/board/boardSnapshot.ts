'use client'

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { getAllZones, themedColor, type ThreeDZone, type ZoneRect } from '@/widgets/VideoRoom/CallWhiteboard/shapeGeometry'
import type { BoardScene } from './boardScene'

// A board block's picture for the document, PDF and Word. Excalidraw exports
// its own elements; the 3D zones (WebGL on the live board, no readable
// buffer) are drawn here onto the same 2D canvas with the board's own
// projection helpers — so edges, hidden (dashed) edges, construction lines,
// angle marks and labels match what the student saw.

const SCALE = 2
const MARGIN = 24

function elementBox(el: ExcalidrawElement): [number, number, number, number] {
  const pts = (el as unknown as { points?: readonly [number, number][] }).points
  if (pts?.length) {
    const xs = pts.map(p => el.x + p[0])
    const ys = pts.map(p => el.y + p[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  // Rotated boxes: the rotated rectangle's own bounding box.
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const c = Math.abs(Math.cos(el.angle))
  const s = Math.abs(Math.sin(el.angle))
  const hw = (el.width * c + el.height * s) / 2
  const hh = (el.width * s + el.height * c) / 2
  return [cx - hw, cy - hh, cx + hw, cy + hh]
}

async function drawZone(ctx: CanvasRenderingContext2D, zone: ThreeDZone, rect: ZoneRect) {
  const THREE = await import('three')
  const r = await import('@/widgets/VideoRoom/CallWhiteboard/threeDRender')
  const geometry = r.buildGeometry(zone.primitive, zone.segments ?? 0, zone.flat ?? false)
  const topology = r.buildEdgeTopology(geometry)
  const faces = r.buildFaceTopology(geometry)
  geometry.dispose()
  const camera = r.createFramingCamera(rect.width, rect.height, zone.scale)
  camera.updateMatrixWorld()
  const group = new THREE.Group()
  group.rotation.set(zone.rotationX, zone.rotationY, zone.rotationZ)
  group.scale.setScalar(zone.scale)
  group.updateMatrixWorld(true)
  const P = (v: InstanceType<typeof THREE.Vector3>) => r.projectPoint(v, group, camera, rect.width, rect.height)

  ctx.save()
  ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2)
  ctx.rotate(rect.angle)
  ctx.translate(-rect.width / 2, -rect.height / 2)
  ctx.lineCap = 'round'

  // Edges: visible solid, hidden dashed — same classification as the board.
  r.classifyEdges(topology, zone.rotationX, zone.rotationY, zone.rotationZ).forEach((edge, i) => {
    const a = P(edge.v1)
    const b = P(edge.v2)
    ctx.strokeStyle = themedColor(zone.edgeColors?.[i] ?? zone.color, false)
    ctx.lineWidth = zone.selection?.kind === 'edge' && zone.selection.edgeIndex === i ? 3 : 1.6
    ctx.setLineDash(edge.dashed ? [6, 5] : [])
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  })

  // Construction lines (medians, heights…): dash-dot, like on the board.
  const lines = zone.constructionLines ?? []
  for (const line of lines) {
    const p1 = r.resolveLocalSnapPoint(topology, faces, lines, line.startRef)
    const p2 = r.resolveLocalSnapPoint(topology, faces, lines, line.endRef)
    if (!p1 || !p2) continue
    const a = P(p1); const b = P(p2)
    ctx.strokeStyle = themedColor(line.color, false)
    ctx.lineWidth = 1.4
    ctx.setLineDash([8, 3, 1.5, 3])
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  ctx.setLineDash([])

  // Angle marks: small arcs between the two arms.
  const labels: { x: number; y: number; text: string; color: string }[] = []
  for (const mark of zone.vertexMarks ?? []) {
    const g = r.resolveAngleGeometry(topology, faces, lines, mark.armA, mark.armB)
    if (!g) continue
    const endsA = r.resolveArmEndpoints(topology, faces, lines, mark.armA)
    const endsB = r.resolveArmEndpoints(topology, faces, lines, mark.armB)
    const lenA = endsA ? Math.max(endsA[0].distanceTo(g.vertex), endsA[1].distanceTo(g.vertex)) : 1
    const lenB = endsB ? Math.max(endsB[0].distanceTo(g.vertex), endsB[1].distanceTo(g.vertex)) : 1
    const radius = Math.min(0.35, Math.max(0.08, Math.min(lenA, lenB) * 0.3))
    const pts = r.buildAngleArcPoints(g.vertex, g.dirA, g.dirB, g.dirA.clone().cross(g.dirB), radius).map(P)
    if (pts.length < 2) continue
    ctx.strokeStyle = themedColor(mark.color, false)
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke()
    if (mark.label) { const m = pts[Math.floor(pts.length / 2)]; labels.push({ x: m.x, y: m.y, text: mark.label, color: mark.color }) }
  }

  // Edge and line labels, upright at the projected midpoints (as on the board).
  for (const [key, text] of Object.entries(zone.edgeLabels ?? {})) {
    const edge = topology[Number(key)]
    if (!edge || !text) continue
    const m = P(edge.v1.clone().add(edge.v2).multiplyScalar(0.5))
    labels.push({ x: m.x, y: m.y, text, color: zone.edgeColors?.[Number(key)] ?? zone.color })
  }
  for (const line of lines) {
    if (!line.label) continue
    const p1 = r.resolveLocalSnapPoint(topology, faces, lines, line.startRef)
    const p2 = r.resolveLocalSnapPoint(topology, faces, lines, line.endRef)
    if (!p1 || !p2) continue
    const m = P(p1.clone().add(p2).multiplyScalar(0.5))
    labels.push({ x: m.x, y: m.y, text: line.label, color: line.color })
  }
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const l of labels) {
    const w = ctx.measureText(l.text).width + 8
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillRect(l.x - w / 2, l.y - 9, w, 18)
    ctx.fillStyle = themedColor(l.color, false)
    ctx.fillText(l.text, l.x, l.y)
  }
  ctx.restore()
}

/** Scene → PNG (2×) for the document. Null for an empty board. */
export async function snapshotBoard(scene: BoardScene): Promise<{ blob: Blob; width: number; height: number } | null> {
  const live = scene.elements.filter(e => !e.isDeleted)
  if (!live.length) return null
  const { exportToCanvas, convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
  const zones = getAllZones(live)
  const zoneIds = new Set(zones.map(z => z.element.id))

  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const el of live) {
    const [a, b, c, d] = elementBox(el)
    minX = Math.min(minX, a); minY = Math.min(minY, b); maxX = Math.max(maxX, c); maxY = Math.max(maxY, d)
  }
  minX -= MARGIN; minY -= MARGIN; maxX += MARGIN; maxY += MARGIN
  // Two invisible corner anchors pin Excalidraw's export bounds to ours, so
  // the zones drawn afterwards land exactly where they are on the board.
  const anchors = convertToExcalidrawElements([
    { type: 'rectangle', x: minX, y: minY, width: 1, height: 1, strokeColor: 'transparent', backgroundColor: 'transparent', opacity: 0 },
    { type: 'rectangle', x: maxX - 1, y: maxY - 1, width: 1, height: 1, strokeColor: 'transparent', backgroundColor: 'transparent', opacity: 0 },
  ])
  const elements = [...live.filter(e => !zoneIds.has(e.id)), ...anchors]
  const canvas = await exportToCanvas({
    elements,
    files: scene.files,
    appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
    exportPadding: 0,
    getDimensions: (w: number, h: number) => ({ width: w * SCALE, height: h * SCALE, scale: SCALE }),
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.save()
  // exportToCanvas leaves its own transform on the context — start clean.
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.translate(-minX, -minY)
  for (const { zone, rect } of zones) await drawZone(ctx, zone, rect)
  ctx.restore()
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
  return blob ? { blob, width: canvas.width, height: canvas.height } : null
}
