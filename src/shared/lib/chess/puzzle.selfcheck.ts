import assert from 'node:assert/strict'
import {checkPuzzleMove, fenError, playUci, scorePuzzle} from './puzzle'

// 1.Qe8+ Rxe8 2.Rxe8# — a back-rank mate worked out by hand.
const BACK_RANK = '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1'
const SOLUTION = ['e2e8', 'd8e8', 'e1e8']

// Right first move: the opponent's reply from the solution comes back, puzzle not over yet.
assert.deepEqual(checkPuzzleMove(BACK_RANK, SOLUTION, 0, 'e2e8'), {ok: true, reply: 'd8e8', done: false})
// Wrong first move (legal, but not the solution): rejected.
assert.deepEqual(checkPuzzleMove(BACK_RANK, SOLUTION, 0, 'e1e8'), {ok: false})
// Last move after the reply: solved, no further reply.
const afterReply = '4r1k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 2'
assert.deepEqual(checkPuzzleMove(afterReply, SOLUTION, 2, 'e1e8'), {ok: true, reply: null, done: true})

// Another mate in one counts as the solution (Lichess convention): Ra8# and Rb8# both mate.
const TWO_MATES = '6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1'
assert.deepEqual(checkPuzzleMove(TWO_MATES, ['a1a8'], 0, 'b1b8'), {ok: true, reply: null, done: true})
// ...but a non-mating alternative does not.
assert.deepEqual(checkPuzzleMove(TWO_MATES, ['a1a8'], 0, 'a1a7'), {ok: false})

// Promotion must match the piece too.
const PROMO = '8/P5k1/8/8/8/8/8/6K1 w - - 0 1'
assert.deepEqual(checkPuzzleMove(PROMO, ['a7a8q'], 0, 'a7a8n'), {ok: false})
assert.deepEqual(checkPuzzleMove(PROMO, ['a7a8q'], 0, 'a7a8q'), {ok: true, reply: null, done: true})

// All or nothing: solved without a single wrong try = 1 point, anything else = 0.
assert.equal(scorePuzzle({done: true, mistakes: 0}), 1)
assert.equal(scorePuzzle({done: true, mistakes: 1}), 0)
assert.equal(scorePuzzle({done: false, mistakes: 0}), 0)

// Right move → the reply from the solution is played → a wrong second move is still rejected.
const step1 = checkPuzzleMove(BACK_RANK, SOLUTION, 0, 'e2e8')
assert.ok(step1.ok && step1.reply === 'd8e8')
const afterQ = playUci(BACK_RANK, 'e2e8')!
const afterR = playUci(afterQ.fen, step1.reply!)!
assert.equal(afterR.fen, afterReply)
assert.deepEqual(checkPuzzleMove(afterR.fen, SOLUTION, 2, 'e1e7'), {ok: false}) // legal rook move, not mate

// fenError, positions checked by hand.
assert.equal(fenError('8/8/8/8/8/8/8/8 w - - 0 1'), 'kings') // no kings at all
assert.equal(fenError('4k3/8/8/8/8/8/8/P3K3 w - - 0 1'), 'pawns') // white pawn on a1
// Re1 gives check to the black king on e8 along the open e-file:
assert.equal(fenError('4k3/8/8/8/8/8/8/4RK2 w - - 0 1'), 'check') // ...while White is to move — impossible
assert.equal(fenError('4k3/8/8/8/8/8/8/4RK2 b - - 0 1'), null) // ...Black to move and in check — fine
assert.equal(fenError('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), null)

console.log('puzzle ok')
