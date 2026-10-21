import assert from 'node:assert/strict'
import { diffEvents } from './diffEvents'

// 1.e4 d5 2.exd5 — the black pawn on d5 is taken.
const E4D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
const EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'
assert.deepEqual(diffEvents(E4D5, EXD5, { from: 'e4', to: 'd5' }), [{ kind: 'capture', square: 'd5', code: 'bP' }])

// En passant: the taken pawn is not on the target square — 3.exd6 e.p. removes d5.
const EP_BEFORE = 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'
const EP_AFTER = 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3'
assert.deepEqual(diffEvents(EP_BEFORE, EP_AFTER, { from: 'e5', to: 'd6' }), [{ kind: 'capture', square: 'd5', code: 'bP' }])

// A quiet move, a first render and an unchanged fen celebrate nothing.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
assert.deepEqual(diffEvents(START, E4, { from: 'e2', to: 'e4' }), [])
assert.deepEqual(diffEvents(null, E4), [])
assert.deepEqual(diffEvents(E4, E4), [])

// Promotion with capture: bxa8=Q — the rook pops, then the queen flashes on the same square.
assert.deepEqual(diffEvents('r7/1P5k/8/8/8/8/8/4K3 w - - 0 40', 'Q7/7k/8/8/8/8/8/4K3 b - - 0 40', { from: 'b7', to: 'a8' }), [
  { kind: 'capture', square: 'a8', code: 'bR' },
  { kind: 'promotion', square: 'a8', code: 'wQ' },
])
// A rook simply arriving on the last rank is not a promotion.
assert.deepEqual(diffEvents('8/7k/8/8/8/8/R7/4K3 w - - 0 40', 'R7/7k/8/8/8/8/8/4K3 b - - 0 40', { from: 'a2', to: 'a8' }), [])

// New game: the starting position after a game in progress.
assert.deepEqual(diffEvents(EXD5, START), [{ kind: 'newGame' }])

// Undo: the move counter goes back; the taken piece comes back on its square.
assert.deepEqual(diffEvents(EXD5, E4D5), [{ kind: 'undo', squares: ['d5'] }])
// Undo of a whole move pair in a bot game back to the start is still an undo, not a new game.
assert.deepEqual(diffEvents(E4D5, START), [{ kind: 'undo', squares: [] }])

// Check: 1.e4 f5 2.Qh5+ — the black king on e8 pulses.
assert.deepEqual(
  diffEvents('rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2', 'rnbqkbnr/ppppp1pp/8/5p1Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2'),
  [{ kind: 'check', square: 'e8' }]
)
// Mate: scholar's mate Qxf7# — the pawn pops and the wave starts from e8.
assert.deepEqual(
  diffEvents('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'),
  [{ kind: 'capture', square: 'f7', code: 'bP' }, { kind: 'mate', square: 'e8' }]
)

// An unrelated position with a lower move number (next puzzle, storm, call, block editor) is not an undo.
const SCHOLAR = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
assert.deepEqual(diffEvents(SCHOLAR, '8/7k/8/8/8/8/R7/4K3 w - - 0 2'), [])
// …nor is a jump back by more than two plies, even with few changed squares.
assert.deepEqual(diffEvents('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 9', E4.replace(' 0 1', ' 0 5')), [])
// …and an unrelated position exactly one ply later is not a capture either.
assert.deepEqual(diffEvents(E4D5, '8/7k/8/8/8/8/R7/4K3 b - - 0 2'), [])

console.log('effects ok')
