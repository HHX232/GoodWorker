import type { EngineLine } from './engine'
import { sideToMoveCp } from './coachModel'

export type HintArrow = { from: string; to: string; opacity: number }

const OPACITY = [1, 0.6, 0.35]
/** A line losing more than this vs the best one is a mistake, not an "almost best" move. */
const MAX_LOSS_CP = 100

/** MultiPV lines of the position to move in → up to 3 arrows, best first; equal scores get equal opacity. */
export function hintArrows(lines: EngineLine[]): HintArrow[] {
  const scored = lines
    .filter((l) => l.uci.length >= 4 && (l.scoreCp != null || l.mate != null))
    .map((l) => ({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), v: sideToMoveCp(l) }))
    .sort((a, b) => b.v - a.v)
  if (!scored.length) return []
  const top = scored[0].v
  const out: HintArrow[] = []
  const values: number[] = []
  for (const s of scored) {
    if (top - s.v > MAX_LOSS_CP || out.length === 3) break
    if (out.some((a) => a.from === s.from && a.to === s.to)) continue
    if (!values.includes(s.v)) values.push(s.v)
    out.push({ from: s.from, to: s.to, opacity: OPACITY[values.length - 1] })
  }
  return out
}
