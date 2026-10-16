import assert from 'node:assert/strict'
import { acceptChessState, applyChessMove, initialChessState, setChessPosition } from './chessSync'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const s0 = initialChessState()
assert.deepEqual(s0, { fen: START, lastMove: null, moveAllowed: 'all', seq: 0 })

// Student plays 1.e4 from the position it saw (seq 0): owner accepts, seq grows.
const s1 = applyChessMove(s0, { from: 'e2', to: 'e4', seq: 0 }, false)
assert.ok(s1)
assert.equal(s1.fen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
assert.deepEqual(s1.lastMove, { from: 'e2', to: 'e4' })
assert.equal(s1.seq, 1)

// "Only me": the owner's own move passes, a participant's move is rejected.
const locked = { ...s0, moveAllowed: 'owner' as const }
assert.equal(applyChessMove(locked, { from: 'e2', to: 'e4', seq: 0 }, false), null)
assert.equal(applyChessMove(locked, { from: 'e2', to: 'e4', seq: 0 }, true)?.seq, 1)

// Student moved on the position it saw at seq 0, but the owner already moved (seq 1): stale → rejected,
// even though d7d5 would be legal now.
assert.equal(applyChessMove(s1, { from: 'd7', to: 'd5', seq: 0 }, false), null)
assert.equal(applyChessMove(s1, { from: 'd7', to: 'd5', seq: 1 }, false)?.seq, 2)
// Illegal: a white pawn on black's turn, a knight jumping like a bishop.
assert.equal(applyChessMove(s1, { from: 'd2', to: 'd4', seq: 1 }, false), null)
assert.equal(applyChessMove(s0, { from: 'g1', to: 'e3', seq: 0 }, true), null)

// Receiving call_chess_state: first one is taken; an older or repeated seq arriving later is ignored.
const msg = (st: object) => ({ type: 'call_chess_state', ...st })
assert.deepEqual(acceptChessState(null, msg(s1)), s1)
assert.equal(acceptChessState(s1, msg(s0)), null)
assert.equal(acceptChessState(s1, msg(s1)), null)
const s2 = { fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', lastMove: { from: 'd7', to: 'd5' }, moveAllowed: 'owner', seq: 2 }
assert.deepEqual(acceptChessState(s1, msg(s2)), s2)
// Garbage from the channel never replaces the board.
assert.equal(acceptChessState(s1, msg({ ...s2, fen: 'not a fen' })), null)
assert.equal(acceptChessState(s1, msg({ ...s2, moveAllowed: 'anyone' })), null)
assert.equal(acceptChessState(s1, msg({ ...s2, seq: '9' })), null)

// Owner sets a position (FEN field, or reset = start position): newer seq so everyone takes it.
const endgame = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'
const p1 = setChessPosition(s1, endgame)
assert.deepEqual(p1, { fen: endgame, lastMove: null, moveAllowed: 'all', seq: 2 })
assert.equal(setChessPosition(s1, '  ' + endgame + ' ')?.fen, endgame)
assert.equal(acceptChessState(s1, msg(p1!))?.fen, endgame)
// Invalid FEN: no kings, garbage, empty.
assert.equal(setChessPosition(s1, '8/8/8/8/8/8/8/8 w - - 0 1'), null)
assert.equal(setChessPosition(s1, 'hello'), null)
assert.equal(setChessPosition(s1, ''), null)

console.log('chessSync ok')
