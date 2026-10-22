'use client'

import type { BoardSpec } from '@/shared/lib/lecture/boardSpec'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ShapeId, ThreeDZone } from '@/widgets/VideoRoom/CallWhiteboard/shapeGeometry'

/** What a board block stores: the call whiteboard's own scene format. */
export interface BoardScene {
  elements: readonly ExcalidrawElement[]
  files: BinaryFiles
}

export const EMPTY_SCENE: BoardScene = { elements: [], files: {} }

const ZONE = 240

/** AI spec → the board's primitives: pyramid/prism over N sides map onto the call board's cone/polygon segments. */
function toZone(solid: BoardSpec['shapes'][number]): { primitive: ShapeId; segments?: number; flat?: boolean } {
  const n = solid.sides ?? 4
  switch (solid.solid) {
    case 'cube': return { primitive: 'cube' }
    case 'pyramid': return n === 4 ? { primitive: 'pyramid' } : { primitive: 'cone', segments: n }
    case 'prism': return { primitive: 'polygon', segments: n, flat: false }
    case 'cone': return { primitive: 'cone', segments: 24 }
    case 'cylinder': return { primitive: 'cylinder', segments: 20 }
    case 'sphere': return { primitive: 'sphere', segments: 16 }
    case 'polygon': return { primitive: 'polygon', segments: n, flat: true }
  }
}

/**
 * A fresh scene from the AI's spec: each figure as a real 3D zone (same
 * customData.threeDZone the call board uses — rotatable, labelable,
 * construction lines, angle marks, all of it), given values as text beside it.
 */
export async function buildSceneFromSpec(spec: BoardSpec): Promise<BoardScene> {
  const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
  const skeletons: Parameters<typeof convertToExcalidrawElements>[0] = []
  spec.shapes.forEach((shape, i) => {
    const z = toZone(shape)
    const zone: ThreeDZone = { primitive: z.primitive, rotationX: 0.45, rotationY: 0.6, rotationZ: 0, scale: 1, color: '#1e1e1e', ...(shape.label ? { label: shape.label } : {}), ...(z.segments ? { segments: z.segments } : {}), ...(z.flat ? { flat: true } : {}) }
    const x = i * (ZONE + 40)
    skeletons.push({
      type: 'rectangle', x, y: spec.title ? 50 : 0, width: ZONE, height: ZONE,
      strokeColor: '#94a3b8', backgroundColor: 'transparent', strokeStyle: 'dashed', roughness: 0,
      // Same as the call board: the zone moves/resizes/rotates through its own 3D controls only.
      locked: true,
      customData: { threeDZone: zone },
    })
    if (shape.label) skeletons.push({ type: 'text', x: x + 8, y: (spec.title ? 50 : 0) + ZONE + 8, text: shape.label, fontSize: 20, strokeColor: '#1e1e1e' })
  })
  if (spec.title) skeletons.push({ type: 'text', x: 0, y: 0, text: spec.title, fontSize: 24, strokeColor: '#1e1e1e' })
  const right = spec.shapes.length * (ZONE + 40)
  spec.annotations.forEach((line, i) => {
    skeletons.push({ type: 'text', x: right, y: (spec.title ? 60 : 10) + i * 34, text: line, fontSize: 20, strokeColor: '#1971c2' })
  })
  return { elements: convertToExcalidrawElements(skeletons), files: {} }
}

export function sceneHasContent(scene: BoardScene | null | undefined): boolean {
  return !!scene && scene.elements.some(e => !e.isDeleted)
}
