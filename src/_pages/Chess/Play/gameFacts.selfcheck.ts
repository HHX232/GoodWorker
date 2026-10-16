// npx tsx src/_pages/Chess/Play/gameFacts.selfcheck.ts → "gameFacts ok"
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { engineMoveFacts, endReason } from './gameFacts'

// Positions and expected facts worked out by hand on a board.
const cases: [string, string, unknown][] = [
  // 1.e4 e5 — a quiet pawn move, the pawn hits nothing
  ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e7e5', { san: 'e5', facts: [{ k: 'quiet', piece: 'p', square: 'e5' }] }],
  // 2...Nc6 — develops the knight
  ['rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'b8c6', { san: 'Nc6', facts: [{ k: 'develop', piece: 'n' }] }],
  // Scholar's mate: Qxf7# — mate, takes a pawn
  ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5f7', { san: 'Qxf7#', facts: [{ k: 'mate' }, { k: 'capture', piece: 'p' }] }],
  // Nf3 hits the undefended queen on e5 (and develops)
  ['k7/8/8/4q3/8/8/8/6NK w - - 0 1', 'g1f3', { san: 'Nf3', facts: [{ k: 'threat', piece: 'q', square: 'e5' }, { k: 'develop', piece: 'n' }] }],
  // Nc3 hits the knight on d5, but it is guarded by c6 and worth the same — no threat, just a quiet move
  ['k7/8/2p5/3n4/8/8/4N3/K7 w - - 0 1', 'e2c3', { san: 'Nc3', facts: [{ k: 'quiet', piece: 'n', square: 'c3' }] }],
  // short castling, the rook on f8 attacks nothing
  ['r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8g8', { san: 'O-O', facts: [{ k: 'castle' }] }],
  // a8=Q+ — promotion with check along the 8th rank
  ['4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q', { san: 'a8=Q+', facts: [{ k: 'check' }, { k: 'promote', piece: 'q' }] }],
]

for (const [fen, uci, want] of cases) assert.deepEqual(engineMoveFacts(fen, uci), want, `${fen} ${uci}`)

const at = (fen: string) => new Chess(fen)
const fools = new Chess()
for (const san of ['f3', 'e5', 'g4', 'Qh4#']) fools.move(san)
const shuffle = new Chess()
for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) shuffle.move(san)
assert.equal(endReason(fools, false), 'checkmate')
assert.equal(endReason(at('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), false), 'stalemate')
assert.equal(endReason(at('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), false), 'insufficient')
assert.equal(endReason(shuffle, false), 'threefold')
assert.equal(endReason(at('8/8/8/4k3/8/8/2R5/4K3 w - - 100 80'), false), 'fifty')
assert.equal(endReason(new Chess(), true), 'resign')
assert.equal(endReason(new Chess(), false), null)

console.log('gameFacts ok')
