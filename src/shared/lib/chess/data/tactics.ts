// 15 tactics for /chess/learn (spec «Дополнения после G2»). id = Lichess puzzle theme, sent as `theme=` to
// /api/chess/puzzles/next; `doubleAttack` is a server alias for fork + discoveredAttack.
export type Tactic = { id: string; nameKey: string; descKey: string }

export const TACTICS: Tactic[] = [
  'fork', 'pin', 'skewer', 'doubleAttack', 'discoveredAttack', 'deflection', 'attraction', 'intermezzo',
  'sacrifice', 'hangingPiece', 'promotion', 'backRankMate', 'mateIn1', 'mateIn2', 'mateIn3',
].map((id) => ({ id, nameKey: `tc_${id}_name`, descKey: `tc_${id}_desc` }))

/** Solved count of a tactic from GET /api/chess/progress `byTheme` (no `doubleAttack` key there). */
export function tacticSolved(id: string, byTheme: Record<string, { solved: number }>): number {
  // ponytail: a puzzle tagged both fork and discoveredAttack counts twice for doubleAttack; a server key if it matters.
  const ids = id === 'doubleAttack' ? ['fork', 'discoveredAttack'] : [id]
  return ids.reduce((n, k) => n + (byTheme[k]?.solved ?? 0), 0)
}
