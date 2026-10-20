// npx tsx src/_pages/Chess/Storm/stormModel.selfcheck.ts → "storm ok"
import assert from 'node:assert/strict'
import { miss, solve, startStorm, stormMinRating, tick, timeLeftMs } from './stormModel'

const T0 = 1_000_000
const s = startStorm(3, T0)

// 3 minutes = 180 000 ms, the clock runs down in real time
assert.equal(timeLeftMs(s, T0), 180_000)
assert.equal(timeLeftMs(s, T0 + 30_000), 150_000)
assert.equal(timeLeftMs(startStorm(5, T0), T0), 300_000)

// a solved puzzle scores and costs no time
const s1 = solve(s, T0 + 30_000)
assert.equal(s1.score, 1)
assert.equal(timeLeftMs(s1, T0 + 30_000), 150_000)

// a mistake: −10 s, one error, still running
const s2 = miss(s1, T0 + 30_000)
assert.equal(s2.errors, 1)
assert.equal(timeLeftMs(s2, T0 + 30_000), 140_000)
assert.equal(s2.over, false)

// the third mistake ends the run, whatever the clock says
const s4 = miss(miss(s2, T0 + 40_000), T0 + 50_000)
assert.equal(s4.over, true)
assert.equal(s4.reason, 'errors')
assert.equal(s4.score, 1)
assert.equal(solve(s4, T0 + 51_000).score, 1, 'nothing counts after the end')
assert.equal(timeLeftMs(s4, T0 + 90_000), timeLeftMs(s4, T0 + 50_000), 'the clock stops at the end')

// time out: 180 s − 10 s penalty → over at 170 s
assert.equal(tick(s2, T0 + 169_000).over, false)
const out = tick(s2, T0 + 170_000)
assert.equal(out.over, true)
assert.equal(out.reason, 'time')
assert.equal(timeLeftMs(out, T0 + 200_000), 0)
// a mistake that eats the last seconds ends on time, not on errors
const late = miss(s, T0 + 175_000)
assert.equal(late.over, true)
assert.equal(late.reason, 'time')
assert.equal(solve(tick(s, T0 + 181_000), T0 + 181_000).score, 0, 'no score after the flag')

// difficulty climbs with every puzzle shown (solved or missed): 800, +50 each
assert.equal(stormMinRating(0), 800)
assert.equal(stormMinRating(1), 850)
assert.equal(stormMinRating(10), 1300)

console.log('storm ok')
