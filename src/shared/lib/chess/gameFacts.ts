// Pure chess.js facts for the play page: what the engine's move did (R14 line) and why the game ended.
import { Chess, type PieceSymbol, type Square } from 'chess.js'

export type MoveFact =
  | { k: 'mate' }
  | { k: 'check' }
  | { k: 'capture'; piece: PieceSymbol }
  | { k: 'promote'; piece: PieceSymbol }
  | { k: 'castle' }
  | { k: 'threat'; piece: PieceSymbol; square: Square }
  | { k: 'develop'; piece: PieceSymbol }
  | { k: 'quiet'; piece: PieceSymbol; square: Square }

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

/** Facts about `uci` played in `fenBefore`, most important first. Throws on an illegal move. */
export function engineMoveFacts(fenBefore: string, uci: string): { san: string; facts: MoveFact[] } {
  const chess = new Chess(fenBefore)
  const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  const facts: MoveFact[] = []
  if (chess.isCheckmate()) facts.push({ k: 'mate' })
  else if (chess.inCheck()) facts.push({ k: 'check' })
  if (m.captured) facts.push({ k: 'capture', piece: m.captured })
  if (m.promotion) facts.push({ k: 'promote', piece: m.promotion })
  if (m.isKingsideCastle() || m.isQueensideCastle()) facts.push({ k: 'castle' })
  if (!chess.isCheckmate()) {
    // the most valuable enemy piece the moved piece now hits that is loose or worth more than the attacker
    const them = m.color === 'w' ? 'b' : 'w'
    let target: { piece: PieceSymbol; square: Square } | null = null
    for (const row of chess.board())
      for (const p of row) {
        if (!p || p.color !== them || p.type === 'k' || !chess.attackers(p.square, m.color).includes(m.to)) continue
        const worth = VALUE[p.type] > VALUE[m.promotion ?? m.piece] || !chess.isAttacked(p.square, them)
        if (worth && (!target || VALUE[p.type] > VALUE[target.piece])) target = { piece: p.type, square: p.square }
      }
    if (target) facts.push({ k: 'threat', ...target })
  }
  const homeRank = m.color === 'w' ? '1' : '8'
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === homeRank) facts.push({ k: 'develop', piece: m.piece })
  if (!facts.length) facts.push({ k: 'quiet', piece: m.piece, square: m.to })
  return { san: m.san, facts }
}

export type EndReason = 'checkmate' | 'stalemate' | 'threefold' | 'fifty' | 'insufficient' | 'resign'

export function endReason(chess: Chess, resigned: boolean): EndReason | null {
  if (resigned) return 'resign'
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isInsufficientMaterial()) return 'insufficient'
  if (chess.isThreefoldRepetition()) return 'threefold'
  if (chess.isDrawByFiftyMoves()) return 'fifty'
  return null
}
