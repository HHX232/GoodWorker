// What the AI may ask for when a figure is drawn on the board or described in
// the lecture: a small, validated spec (never raw Excalidraw JSON). The page
// turns it into a real whiteboard scene — the same Excalidraw + 3D-zone
// board as calls — and snapshots it. Prisma-free: client and server share it.

export type BoardSolid = 'cube' | 'pyramid' | 'prism' | 'cone' | 'cylinder' | 'sphere' | 'polygon'

export interface BoardShapeSpec {
  solid: BoardSolid
  /** Base vertices for pyramid/prism/polygon (3 = triangular, 4 = square, 6 = hexagonal…). */
  sides?: number
  /** Name as written on the board, e.g. "SABCD". */
  label?: string
}

export interface BoardSpec {
  title?: string
  shapes: BoardShapeSpec[]
  /** Given values and notes from the board, one per line: "AB = 6 см", "SO ⊥ (ABC)". */
  annotations: string[]
}

const SOLIDS: BoardSolid[] = ['cube', 'pyramid', 'prism', 'cone', 'cylinder', 'sphere', 'polygon']
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Validates an AI/board spec; null when there's nothing usable in it. */
export function parseBoardSpec(raw: unknown): BoardSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const shapes = (Array.isArray(o.shapes) ? o.shapes : [])
    .map((x): BoardShapeSpec | null => {
      const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
      const solid = SOLIDS.includes(r.solid as BoardSolid) ? (r.solid as BoardSolid) : null
      if (!solid) return null
      const sides = Number.isInteger(r.sides) ? Math.min(12, Math.max(3, r.sides as number)) : undefined
      return { solid, ...(sides ? { sides } : {}), ...(s(r.label, 24) ? { label: s(r.label, 24) } : {}) }
    })
    .filter((x): x is BoardShapeSpec => !!x)
    .slice(0, 3)
  const annotations = (Array.isArray(o.annotations) ? o.annotations : []).map(a => s(a, 80)).filter(Boolean).slice(0, 12)
  if (!shapes.length) return null
  return { ...(s(o.title, 80) ? { title: s(o.title, 80) } : {}), shapes, annotations }
}

/** Human line for DeepSeek context / outlines: "[доска: пирамида SABCD; AB = 6]". */
export function boardSummary(spec: BoardSpec | null): string {
  if (!spec) return '[доска]'
  const names: Record<BoardSolid, string> = { cube: 'куб', pyramid: 'пирамида', prism: 'призма', cone: 'конус', cylinder: 'цилиндр', sphere: 'шар', polygon: 'многоугольник' }
  const shapes = spec.shapes.map(sh => `${names[sh.solid]}${sh.label ? ` ${sh.label}` : ''}`).join(', ')
  return `[доска: ${shapes}${spec.annotations.length ? `; ${spec.annotations.slice(0, 4).join('; ')}` : ''}]`
}
