import assert from 'node:assert/strict'
import { accuracy, coachClass, loadGame, reviewGame, winPct } from './reviewModel'
import type { EngineLine } from './engine'

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)

// win% = 50 + 50·(2/(1+e^(−0.00368208·cp))−1) — values worked out by hand (python, spec formula)
near(winPct(0), 50)
near(winPct(300), 75.1126)
near(winPct(-300), 24.8874)
near(winPct(100000), 100)

// accuracy = 103.1668·e^(−0.04354·avg loss) − 3.1669, clamped 0..100
near(accuracy(0), 99.9999)
near(accuracy(10), 63.5826)
assert.equal(accuracy(100), 0)

// ─── thresholds: a quiet non-best move; best line 0 cp (50%), the reply line scored for the opponent ──
const L = (uci: string, scoreCp: number | null, mate: number | null = null): EngineLine => ({ uci, pv: [uci], scoreCp, mate })
const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' // not the start: no book
const one = (oppCp: number) =>
  reviewGame({ initialFen: ITALIAN, moves: ['a2a3'], analyses: [[L('f1b5', 0), L('f1c4', -5)], [L('g8f6', oppCp)]] }).moves[0]
// loss = 50 − win%(−oppCp): 10 → 0.92, 30 → 2.76, 80 → 7.31, 120 → 10.87, 150 → 13.47, 250 → 21.51
near(one(30).loss, 2.7588)
assert.equal(one(10).cls, 'excellent')
assert.equal(one(30).cls, 'good')
assert.equal(one(80).cls, 'inaccuracy')
assert.equal(one(120).cls, 'mistake')
assert.equal(one(150).cls, 'mistake')
assert.equal(one(250).cls, 'blunder')
// the opponent's reply line is better for us than the best line (engine noise): no negative loss
assert.equal(one(-40).loss, 0)

// ─── book / best: from the start, 1.e4 e5 2.Nf3 is the Italian's main line → book, whatever the engine says;
// 2...a6 leaves every OPENINGS line → judged by the engine (here: its top move → best)
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const opening = reviewGame({
  initialFen: START,
  moves: ['e2e4', 'e7e5', 'g1f3', 'a7a6'],
  analyses: [[L('d2d4', 30), L('e2e4', 25)], [L('c7c5', -30), L('e7e5', -35)], [L('b1c3', 35), L('g1f3', 30)], [L('a7a6', -40), L('b8c6', -40)], [L('f1c4', 60)]],
}).moves
assert.deepEqual(opening.map((m) => m.cls), ['book', 'book', 'book', 'best'])
assert.deepEqual(opening.map((m) => m.loss), [0, 0, 0, 0])
// a move that is not in any line is not book even at ply 0
assert.equal(reviewGame({ initialFen: START, moves: ['a2a3'], analyses: [[L('e2e4', 30)], [L('e7e5', -20)]] }).moves[0].cls, 'excellent')

// ─── brilliant: Morphy's 16.Qb8+! (queen to b8, taken by Nd7 for free) Nxb8 17.Rd8# ─────────────
const OPERA_16 = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16'
const finale = (altLine: EngineLine) =>
  reviewGame({
    initialFen: OPERA_16,
    moves: ['b3b8', 'd7b8', 'd1d8'],
    analyses: [[L('b3b8', null, 2), altLine], [L('d7b8', null, -1)], [L('d1d8', null, 1)], []],
  })
// without the sacrifice White is only better (+150 → 63%): the queen sac is what wins → brilliant
const opera = finale(L('b3e6', 150))
assert.deepEqual(opera.moves.map((m) => m.cls), ['brilliant', 'best', 'best'])
near(opera.accuracy.w, 99.9999)
assert.equal(opera.counts.w.brilliant, 1)
assert.equal(opera.counts.b.best, 1)
// the same sac when the quiet alternative already mates (≥ 90%): just the best move
assert.deepEqual(finale(L('g5d8', null, 3)).moves.map((m) => m.cls), ['best', 'best', 'best'])
// a capture that trades evenly is no sacrifice: 15.Bxd7+ (bishop takes a rook, the knight takes back)
const OPERA_15 = '4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 2 15'
assert.equal(reviewGame({ initialFen: OPERA_15, moves: ['b5d7'], analyses: [[L('b5d7', 500), L('b3b8', 480)], [L('f6d7', -500)]] }).moves[0].cls, 'best')
// a piece that already hung before the move is not offered by it: rook a2 en prise to Qd5 all along,
// the best move is a quiet king step (alternative +100 → 59%) → best, not brilliant
const HANGING = '4k3/8/8/3q4/8/8/R7/4K3 w - - 0 1'
assert.equal(reviewGame({ initialFen: HANGING, moves: ['e1f1'], analyses: [[L('e1f1', -300), L('a2a8', -320)], [L('d5a2', 300)]] }).moves[0].cls, 'best')

// ─── great: the best move when the next one is ≥ 15% worse (the only move) ────────────────────────
// +50 → 54.59%, second −200 → 32.38%: 22% apart → great; second +30 → 52.76%: 1.8% apart → just best
const only = (secondCp: number) =>
  reviewGame({ initialFen: ITALIAN, moves: ['f1b5'], analyses: [[L('f1b5', 50), L('f1c4', secondCp)], [L('a7a6', -50)]] }).moves[0].cls
assert.equal(only(-200), 'great')
assert.equal(only(30), 'best')

// ─── miss: White blunders (0 → Black +400: White loses 31.35%), Black had 81.35% — 31.35% more than before
// the blunder — and plays a move worth only 65.99% (White −180): 15.36% thrown away, not a blunder → miss
const afterBlunder = (blackReplyWhiteCp: number, whiteFirstCp = 400) =>
  reviewGame({
    initialFen: ITALIAN,
    moves: ['a2a3', 'a7a6'],
    analyses: [[L('f1b5', 0), L('f1c4', -5)], [L('g8f6', whiteFirstCp), L('f8c5', whiteFirstCp - 50)], [L('f1c4', blackReplyWhiteCp)]],
  }).moves.map((m) => m.cls)
assert.deepEqual(afterBlunder(-180), ['blunder', 'miss'])
// after a White mistake (+150 for Black: 13.47% lost, Black's chance grew < 20%) a Black move worth 47.24%
// (White +30) loses 16.23% — an ordinary mistake, not a miss
assert.deepEqual(afterBlunder(30, 150), ['mistake', 'mistake'])
// throwing away > 20% after the blunder is a blunder, not a miss (White −100 → Black 59.07%: 22.28% lost)
assert.deepEqual(afterBlunder(-100), ['blunder', 'blunder'])

// ─── accuracy of a side = formula on its average loss ──────────────────────────────────────────────
const blunderGame = reviewGame({
  initialFen: ITALIAN,
  moves: ['a2a3', 'a7a6'],
  analyses: [[L('f1b5', 0)], [L('g8f6', 400)], [L('f1c4', -180)]],
})
near(blunderGame.accuracy.w, 23.182) // one move, 31.3487% lost
assert.equal(blunderGame.counts.w.blunder, 1)
// a mate in 1 thrown away into a mate against us: ~100% lost → 0
const thrown = reviewGame({ initialFen: ITALIAN, moves: ['a2a3'], analyses: [[L('f1b5', null, 1)], [L('g8f6', null, 1)]] })
assert.equal(thrown.accuracy.w, 0)
assert.equal(thrown.moves[0].cls, 'blunder')
// no analysis for an unfinished position → NO_ANALYSIS, never a made-up class
assert.throws(() => reviewGame({ initialFen: ITALIAN, moves: ['a2a3'], analyses: [[L('f1b5', 0)], []] }), /NO_ANALYSIS/)

// ─── key moments: brilliant / great / miss / mistake / blunder, in order ──────────────────────────
assert.deepEqual(opera.keyMoments, [0])
assert.deepEqual(reviewGame({ initialFen: ITALIAN, moves: ['a2a3', 'a7a6'], analyses: [[L('f1b5', 0)], [L('g8f6', 400)], [L('f1c4', -180)]] }).keyMoments, [0, 1])
// the coach API knows five classes
assert.deepEqual(['brilliant', 'great', 'book', 'excellent', 'miss', 'blunder'].map((c) => coachClass(c as never)), ['best', 'best', 'best', 'good', 'mistake', 'blunder'])

// ─── input: PGN with headers / SAN or UCI move lists / a start FEN ────────────────────────────────
const OPERA_PGN = `[Event "Paris"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 {the pin} 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5
11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`
const g = loadGame({ pgn: OPERA_PGN })!
assert.equal(g.moves.length, 33)
assert.deepEqual([g.moves[0], g.moves[30], g.moves[32]], ['e2e4', 'b3b8', 'd1d8'])
assert.deepEqual([g.white, g.black, g.result], ['Paul Morphy', 'Duke Karl / Count Isouard', '1-0'])
assert.equal(g.initialFen, START)
assert.deepEqual(loadGame({ moves: ['b5d7', 'Nxd7'], initialFen: OPERA_15 })!.moves, ['b5d7', 'f6d7'])
assert.equal(loadGame({ pgn: '1.e4 e5 2.Ke3 Ke6' }), null) // illegal → null, not half a game
assert.equal(loadGame({ moves: ['e2e5'] }), null)
assert.equal(loadGame({ pgn: '' }), null)

console.log('review ok')
