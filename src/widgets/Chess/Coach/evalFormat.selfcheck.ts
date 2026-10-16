import assert from 'node:assert/strict'
import { formatEval } from './evalFormat'

// Mate already on the board (toWhiteCp of a mate-0 line) is "#", not "M1".
assert.equal(formatEval(-100000), '#')
assert.equal(formatEval(100000), '#')
assert.equal(formatEval(99999), 'M1') // mate in 1 = 1 ply
assert.equal(formatEval(-99997), '−M2') // mate in 2 for Black = 3 plies
assert.equal(formatEval(130), '+1.3')
assert.equal(formatEval(-46), '−0.5')
assert.equal(formatEval(0), '0.0')

console.log('evalFormat ok')
