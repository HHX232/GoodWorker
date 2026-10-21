// 15 tactics for /chess/learn (spec «Дополнения после G2»). id = Lichess puzzle theme, sent as `theme=` to
// /api/chess/puzzles/next; `doubleAttack` is a server alias for fork + discoveredAttack.
// `example` (G40) — the card's mini board: a position of the theme, white to move; arrows are UCI,
// arrows[0] — the idea move (legal there), the rest — what it threatens.
export type Tactic = { id: string; nameKey: string; descKey: string; gistKey: string; example: { fen: string; arrows: string[] } }

const EXAMPLES: Record<string, [fen: string, ...arrows: string[]]> = {
  fork: ['r3k3/ppp2ppp/8/3N4/8/8/PPP2PPP/4K3 w - - 0 1', 'd5c7', 'c7e8', 'c7a8'],
  pin: ['r1bqkbnr/ppp2ppp/2np4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4', 'f1b5', 'b5e8'],
  skewer: ['4q3/5pp1/4k2p/8/8/6P1/5PKP/R7 w - - 0 1', 'a1e1', 'e1e8'],
  doubleAttack: ['4k3/pp3ppp/8/8/6b1/8/PP3PPP/3QK3 w - - 0 1', 'd1a4', 'a4e8', 'a4g4'],
  discoveredAttack: ['6k1/4qppp/8/8/4N3/8/5PPP/4R1K1 w - - 0 1', 'e4f6', 'e1e7', 'f6g8'],
  deflection: ['4r1k1/3q1ppp/8/8/8/3B4/5PPP/4R1K1 w - - 0 1', 'd3b5', 'e1e8'],
  attraction: ['6k1/5pp1/8/8/8/2B5/1Q3PP1/6KR w - - 0 1', 'h1h8', 'c3g7'],
  intermezzo: ['r3k2r/ppp2ppp/8/8/8/2b5/PPPP1PPP/R1BQKB1R w KQkq - 0 1', 'f1b5', 'd2c3'],
  sacrifice: ['rnbq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQK2R w KQ - 0 1', 'd3h7', 'f3g5'],
  hangingPiece: ['rnbqkb1r/pppp1ppp/8/8/3nP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1', 'd1d4'],
  promotion: ['r5k1/1P3ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1', 'b7b8q', 'b1b8'],
  backRankMate: ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8'],
  mateIn1: ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5f7', 'c4f7'],
  mateIn2: ['r5k1/5ppp/8/8/8/8/1Q3PPP/1R4K1 w - - 0 1', 'b2b8', 'b1b8'],
  mateIn3: ['r5k1/5ppp/n7/8/8/1Q6/1R3PPP/1R4K1 w - - 0 1', 'b3b8', 'b2b8'],
}

export const TACTICS: Tactic[] = [
  'fork', 'pin', 'skewer', 'doubleAttack', 'discoveredAttack', 'deflection', 'attraction', 'intermezzo',
  'sacrifice', 'hangingPiece', 'promotion', 'backRankMate', 'mateIn1', 'mateIn2', 'mateIn3',
].map((id) => {
  const [fen, ...arrows] = EXAMPLES[id]
  return { id, nameKey: `tc_${id}_name`, descKey: `tc_${id}_desc`, gistKey: `tc_${id}_gist`, example: { fen, arrows } }
})

/** Solved count of a tactic from GET /api/chess/progress `byTheme` (no `doubleAttack` key there). */
export function tacticSolved(id: string, byTheme: Record<string, { solved: number }>): number {
  // ponytail: a puzzle tagged both fork and discoveredAttack counts twice for doubleAttack; a server key if it matters.
  const ids = id === 'doubleAttack' ? ['fork', 'discoveredAttack'] : [id]
  return ids.reduce((n, k) => n + (byTheme[k]?.solved ?? 0), 0)
}

/** «Рекомендуем»: the two tactics with the fewest solved; ties keep the list order (basics first). */
export function recommendTactics(byTheme: Record<string, { solved: number }>): string[] {
  return TACTICS.map((t, i) => ({ id: t.id, i, n: tacticSolved(t.id, byTheme) }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .slice(0, 2)
    .map((x) => x.id)
}
