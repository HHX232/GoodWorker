// Self-check for the reader's spread layout (spread.ts). No test runner in this
// project: `npx tsx src/widgets/Files/BookReader/spread.selfcheck.ts`.
// Expected values are worked out by hand from the brief, not by the code under test.
import assert from 'node:assert/strict'
import { cornerFor, spreadPages, stepPage } from './spread'

// Double view: page 1 stands alone on the right; then (2·3), (4·5)…; even page left, odd page right.
assert.deepEqual(spreadPages(1, 'double', 14), [null, 1])
assert.deepEqual(spreadPages(2, 'double', 14), [2, 3])
assert.deepEqual(spreadPages(10, 'double', 14), [10, 11])
assert.deepEqual(spreadPages(11, 'double', 14), [10, 11])
assert.deepEqual(spreadPages(13, 'double', 14), [12, 13])
// The last even page has no partner → alone on the left.
assert.deepEqual(spreadPages(14, 'double', 14), [14, null])
// An odd page count ends on a full pair.
assert.deepEqual(spreadPages(13, 'double', 13), [12, 13])
// Single view: just the page.
assert.deepEqual(spreadPages(10, 'single', 14), [10])
assert.deepEqual(spreadPages(1, 'single', 14), [1])

// Reader-mark corner: double → even (left page) top-left, odd (right page) top-right; page 1 is odd → right.
assert.equal(cornerFor(10, 'double'), 'left')
assert.equal(cornerFor(11, 'double'), 'right')
assert.equal(cornerFor(1, 'double'), 'right')
assert.equal(cornerFor(2, 'double'), 'left')
// Single → always top-left, whatever the parity.
assert.equal(cornerFor(10, 'single'), 'left')
assert.equal(cornerFor(11, 'single'), 'left')
assert.equal(cornerFor(1, 'single'), 'left')

// Turning pages. Double: 1 → 2 → 4 → 6…, back 6 → 4 → 2 → 1; a spread's second page counts as its first.
assert.equal(stepPage(1, 1, 'double', 14), 2)
assert.equal(stepPage(2, 1, 'double', 14), 4)
assert.equal(stepPage(3, 1, 'double', 14), 4)
assert.equal(stepPage(4, -1, 'double', 14), 2)
assert.equal(stepPage(2, -1, 'double', 14), 1)
assert.equal(stepPage(1, -1, 'double', 14), 1)
// Ends: 14 pages end on the lone 14; 13 pages end on (12·13) → 12.
assert.equal(stepPage(12, 1, 'double', 14), 14)
assert.equal(stepPage(14, 1, 'double', 14), 14)
assert.equal(stepPage(10, 1, 'double', 13), 12)
assert.equal(stepPage(12, 1, 'double', 13), 12)
// Single: one at a time, held at both ends.
assert.equal(stepPage(5, 1, 'single', 14), 6)
assert.equal(stepPage(5, -1, 'single', 14), 4)
assert.equal(stepPage(14, 1, 'single', 14), 14)
assert.equal(stepPage(1, -1, 'single', 14), 1)
// Landing on an arbitrary page (typed number, mode switch): clamped, and in double snapped to its spread's left page.
assert.equal(stepPage(11, 0, 'double', 14), 10)
assert.equal(stepPage(99, 0, 'single', 14), 14)
assert.equal(stepPage(0, 0, 'single', 14), 1)
assert.equal(stepPage(99, 0, 'double', 13), 12)

// Tiny books. 1 page: the only page stands alone on the right; nowhere to turn.
assert.deepEqual(spreadPages(1, 'double', 1), [null, 1])
assert.equal(stepPage(1, 1, 'double', 1), 1)
assert.equal(stepPage(1, -1, 'double', 1), 1)
assert.equal(stepPage(1, 1, 'single', 1), 1)
assert.equal(stepPage(2, 0, 'double', 1), 1)
// 2 pages: page 1 alone, then page 2 alone on the left (no page 3 to pair with).
assert.deepEqual(spreadPages(1, 'double', 2), [null, 1])
assert.deepEqual(spreadPages(2, 'double', 2), [2, null])
assert.equal(stepPage(1, 1, 'double', 2), 2)
assert.equal(stepPage(2, 1, 'double', 2), 2)
assert.equal(stepPage(2, -1, 'double', 2), 1)
assert.equal(stepPage(1, 1, 'single', 2), 2)
assert.equal(stepPage(2, 1, 'single', 2), 2)
assert.equal(stepPage(2, -1, 'single', 2), 1)
assert.deepEqual(spreadPages(2, 'single', 2), [2])

console.log('spread.selfcheck: ok')
