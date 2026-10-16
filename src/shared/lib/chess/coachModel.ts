import type { EngineLine } from './engine'

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

const MATE = 100000

/** Line value for the side to move; mate in n → ±(100000 − plies to mate). */
function value(line: EngineLine): number {
  if (line.mate != null) {
    const ply = Math.max(0, Math.abs(line.mate) * 2 - 1)
    return line.mate > 0 ? MATE - ply : -MATE + ply
  }
  return line.scoreCp ?? 0
}

export function toWhiteCp(line: EngineLine, turn: 'w' | 'b'): number {
  const v = value(line)
  return turn === 'w' ? v : -v
}

const scored = (l: EngineLine | null | undefined): l is EngineLine => !!l && (l.scoreCp != null || l.mate != null)

/** Throws Error('NO_ANALYSIS') when the engine gave no scored line before or after the move. */
function assertAnalysed(before: EngineLine[], after: EngineLine | null | undefined): asserts after is EngineLine {
  if (!scored(before[0]) || !scored(after)) throw new Error('NO_ANALYSIS')
}

/**
 * Centipawns the mover gave up vs the engine's top line. `after` is scored for the opponent
 * (game over after the move: pass `{mate: 0}` for checkmate, `{scoreCp: 0}` for a draw).
 */
export function cpLoss(before: EngineLine[], after: EngineLine | null | undefined, playedUci: string): number {
  assertAnalysed(before, after)
  if (before[0].uci === playedUci) return 0
  return Math.max(0, value(before[0]) + value(after))
}

export function classifyMove(before: EngineLine[], afterBestForOpponent: EngineLine | null | undefined, playedUci: string): MoveClass {
  const loss = cpLoss(before, afterBestForOpponent, playedUci)
  if (before[0].uci === playedUci) return 'best'
  if (loss <= 50) return 'good'
  if (loss <= 100) return 'inaccuracy'
  if (loss <= 300) return 'mistake'
  return 'blunder'
}
