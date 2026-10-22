// npx tsx src/shared/lib/chess/motifs.selfcheck.ts → "motifs ok"
// Every position and expectation below is worked out by hand on a board.
import assert from 'node:assert/strict'
import { coachMarks, whyMove } from './motifs'

// Knight fork: White Ke1 Ra1 Bf2 Ph2 vs Black Kh8 Nd4. White plays h3?, Black Nc2+ forks king e1 and rook a1, then Nxa1.
const FORK = '7k/8/8/8/3n4/8/5B1P/R3K3 w Q - 0 1'
{
  const w = whyMove({ fen: FORK, played: 'h2h3', reply: ['d4c2', 'e1d2', 'c2a1', 'd2c1'], replyMate: null, best: ['f2d4'], bestMate: null })
  assert.deepEqual(w.reply, { uci: 'd4c2', san: 'Nc2+', piece: 'n' })
  assert.deepEqual(w.motif, { k: 'fork', by: { piece: 'n', square: 'c2' }, targets: [{ piece: 'k', square: 'e1' }, { piece: 'r', square: 'a1' }] })
  assert.equal(w.loss, 5) // the rook, nothing back
}

// Pin: White Ke1 Qc2 Pa2 Pb2 vs Black Kf7 Rd8. Qe4?? walks onto the e-file: Re8 pins the queen to the king,
// Qxe8+ Kxe8 — queen for rook, minus 4.
{
  const w = whyMove({ fen: '3r4/5k2/8/8/8/8/PPQ5/4K3 w - - 0 1', played: 'c2e4', reply: ['d8e8', 'e4e8', 'f7e8'], replyMate: null, best: ['c2h7'], bestMate: null })
  assert.deepEqual(w.motif, { k: 'pin', by: { piece: 'r', square: 'e8' }, pinned: { piece: 'q', square: 'e4' }, behind: { piece: 'k', square: 'e1' } })
  assert.equal(w.loss, 4)
}

// Skewer: White Kd4 Qf2 Pa2 vs Black Kg8 Bc7. After a3?, Bb6+ hits the king on d4 through c5; the king steps away, Bxf2.
{
  const w = whyMove({ fen: '6k1/2b5/8/8/3K4/8/P4Q2/8 w - - 0 1', played: 'a2a3', reply: ['c7b6', 'd4e4', 'b6f2'], replyMate: null, best: ['f2f7'], bestMate: null })
  assert.deepEqual(w.motif, { k: 'skewer', by: { piece: 'b', square: 'b6' }, front: { piece: 'k', square: 'd4' }, behind: { piece: 'q', square: 'f2' } })
  assert.equal(w.loss, 9)
  assert.equal(w.lost, 'q')
}

// Discovered attack: White Kg1 Qe2 Pa2 Ph2 vs Black Kg8 Re8 Be5. After a3?, Bxh2+ checks and opens the e-file:
// Kxh2 Rxe2 — pawn + queen for the bishop, minus 7: the queen is what goes.
{
  const w = whyMove({ fen: '4r1k1/8/8/4b3/8/8/P3Q2P/6K1 w - - 0 1', played: 'a2a3', reply: ['e5h2', 'g1h2', 'e8e2'], replyMate: null, best: ['e2e5'], bestMate: null })
  assert.deepEqual(w.motif, { k: 'discovered', by: { piece: 'r', square: 'e8' }, target: { piece: 'q', square: 'e2' } })
  assert.equal(w.loss, 7)
  assert.equal(w.lost, 'q')
}

// Overloaded defender: White Kg1 Na3 Nc3 Pb2 Ph2 vs Black Kg8 Rc8 Bf8. The b2 pawn alone guards both knights.
// After h3?, Rxc3 bxc3 Bxa3: rook for two knights, minus 1.
{
  const w = whyMove({ fen: '2r2bk1/8/8/8/8/N1N5/1P5P/6K1 w - - 0 1', played: 'h2h3', reply: ['c8c3', 'b2c3', 'f8a3', 'g1f2'], replyMate: null, best: ['c3e4'], bestMate: null })
  assert.deepEqual(w.motif, { k: 'overload', defender: { piece: 'p', square: 'b2' }, target: { piece: 'n', square: 'c3' }, also: { piece: 'n', square: 'a3' } })
  assert.equal(w.loss, 1)
}

// Loose piece: White Ke1 Nb1 vs Black Kh8 Bf6. Nc3?? puts the knight on the bishop's diagonal with no guard; Bxc3+.
{
  const w = whyMove({ fen: '7k/8/5b2/8/8/8/8/1N2K3 w - - 0 1', played: 'b1c3', reply: ['f6c3', 'e1d1'], replyMate: null, best: ['b1d2'], bestMate: null })
  assert.deepEqual(w.motif, { k: 'hanging', target: { piece: 'n', square: 'c3' }, defended: false })
  assert.equal(w.loss, 3)
  assert.equal(w.lost, 'n')
}

// Mate by the engine's score: White Kg1 Rd1 Pf2 Pg2 Ph2 vs Black Kg8 Re8. Rd7?? leaves the back rank: Re1# (mate in 1);
// the same line scored as mate in 2 says 2. No material changes hands — the mate still counts.
{
  const BACK_RANK = '4r1k1/8/8/8/8/8/5PPP/3R2K1 w - - 0 1'
  const w1 = whyMove({ fen: BACK_RANK, played: 'd1d7', reply: ['e8e1'], replyMate: 1, best: ['g1f1'], bestMate: null })
  assert.deepEqual(w1.motif, { k: 'mate', n: 1 })
  assert.deepEqual(w1.reply, { uci: 'e8e1', san: 'Re1#', piece: 'r' })
  assert.deepEqual(whyMove({ fen: BACK_RANK, played: 'd1d7', reply: ['e8e1'], replyMate: 2, best: ['g1f1'], bestMate: null }).motif, { k: 'mate', n: 2 })
  // a negative mate score is the mover mating — not a threat against him
  assert.equal(whyMove({ fen: BACK_RANK, played: 'd1d7', reply: ['e8e1'], replyMate: -3, best: ['g1f1'], bestMate: null }).motif?.k === 'mate', false)
}

// The best move against the knight fork: Bxd4 takes the forking knight first; Ra4 takes the rook off a1 in advance;
// Kd1 (from e1) guards c2 — Nc2 is no fork any more.
{
  const base = { fen: FORK, played: 'h2h3', reply: ['d4c2', 'e1d2', 'c2a1', 'd2c1'], replyMate: null, bestMate: null }
  const takes = whyMove({ ...base, best: ['f2d4'] }).best
  assert.equal(takes?.san, 'Bxd4+') // and checks h8 along the long diagonal
  assert.deepEqual(takes?.fix, { k: 'takes', target: { piece: 'n', square: 'd4' } })
  assert.equal(takes?.gain, 3)
  assert.deepEqual(whyMove({ ...base, best: ['a1a4'] }).best?.fix, { k: 'saves', piece: { piece: 'r', square: 'a1' } })
  // the king steps off e1 too — it is a fork target, so this also "saves" it
  assert.deepEqual(whyMove({ ...base, best: ['e1d1'] }).best?.fix, { k: 'saves', piece: { piece: 'k', square: 'e1' } })
}

// Hanging knight: Nd2 instead of Nc3 — the bishop can no longer take it, nothing named is saved or taken.
{
  const w = whyMove({ fen: '7k/8/5b2/8/8/8/8/1N2K3 w - - 0 1', played: 'b1c3', reply: ['f6c3'], replyMate: null, best: ['b1d2'], bestMate: null })
  assert.deepEqual(w.best?.fix, { k: 'stops' })
  assert.equal(w.best?.motif, null)
}

// The best move carries its own tactic: Black to move missed Nc2+ (fork, wins the rook); Kg8 lost nothing concrete.
{
  const w = whyMove({ fen: '7k/8/8/8/3n4/8/7P/R3K3 b Q - 0 1', played: 'h8g8', reply: ['a1a4'], replyMate: null, best: ['d4c2', 'e1d2', 'c2a1'], bestMate: null })
  assert.equal(w.motif, null)
  assert.equal(w.loss, 0)
  assert.deepEqual(w.best?.motif, { k: 'fork', by: { piece: 'n', square: 'c2' }, targets: [{ piece: 'k', square: 'e1' }, { piece: 'r', square: 'a1' }] })
  assert.equal(w.best?.gain, 5)
  // a mate score for the best line is the best move's motif
  assert.deepEqual(whyMove({ fen: '7k/8/8/8/3n4/8/7P/R3K3 b Q - 0 1', played: 'h8g8', reply: ['a1a4'], replyMate: null, best: ['d4c2'], bestMate: 4 }).best?.motif, { k: 'mate', n: 4 })
}

// Board drawing for the fork: red Nc2 (d4→c2), the two fork lines from c2, green Bxd4; the forked pieces are lit. ≤ 4 arrows.
{
  const w = whyMove({ fen: FORK, played: 'h2h3', reply: ['d4c2', 'e1d2', 'c2a1'], replyMate: null, best: ['f2d4'], bestMate: null })
  const { arrows, highlights } = coachMarks(w)
  assert.deepEqual(arrows.map((a) => [a.from, a.to, a.kind]), [
    ['d4', 'c2', 'reply'], ['c2', 'e1', 'line'], ['c2', 'a1', 'line'], ['f2', 'd4', 'best'],
  ])
  assert.deepEqual(highlights, ['e1', 'a1'])
  // pin: the line runs from the pinner through the pinned queen to the king behind it
  const pin = whyMove({ fen: '3r4/5k2/8/8/8/8/PPQ5/4K3 w - - 0 1', played: 'c2e4', reply: ['d8e8', 'e4e8', 'f7e8'], replyMate: null, best: ['c2h7'], bestMate: null })
  assert.deepEqual(coachMarks(pin).arrows.map((a) => [a.from, a.to, a.kind]), [['d8', 'e8', 'reply'], ['e8', 'e1', 'line'], ['c2', 'h7', 'best']])
  assert.deepEqual(coachMarks(pin).highlights, ['e4'])
}

console.log('motifs ok')
