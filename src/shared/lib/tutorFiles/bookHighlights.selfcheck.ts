// Self-check for the pure highlight validation (bookHighlights.ts). No test runner
// (see CLAUDE.md): `npx tsx src/shared/lib/tutorFiles/bookHighlights.selfcheck.ts`.
// Expected values are worked out by hand from spec §9, not by the code under test.
import assert from 'node:assert/strict'
import { parseHighlightInput, parseHighlightPatch, parseRects, toHighlight } from './bookHighlights'

const rect = { x: 0.1, y: 0.2, w: 0.5, h: 0.03 }
const ok = { page: 3, text: '  цитата  ', rects: [rect] }

// Valid minimal input: text trimmed, colour defaults to yellow, no note.
assert.deepEqual(parseHighlightInput(ok, 10), { ok: true, data: { page: 3, text: 'цитата', rects: [rect], color: 'yellow', note: null } })
// Colour and note given; blank/space-only note -> null; note trimmed.
assert.deepEqual(parseHighlightInput({ ...ok, color: 'pink', note: ' мысль ' }, 10), { ok: true, data: { page: 3, text: 'цитата', rects: [rect], color: 'pink', note: 'мысль' } })
assert.equal((parseHighlightInput({ ...ok, note: '   ' }, 10) as { data: { note: null } }).data.note, null)
// Boundary values that stay valid: last page, 2000-char text/note, 200 rects, rect at 0 and 1 edges.
assert.equal(parseHighlightInput({ ...ok, page: 10 }, 10).ok, true)
assert.equal(parseHighlightInput({ ...ok, text: 'a'.repeat(2000), note: 'b'.repeat(2000) }, 10).ok, true)
assert.equal(parseHighlightInput({ ...ok, rects: Array(200).fill(rect) }, 10).ok, true)
assert.equal(parseHighlightInput({ ...ok, rects: [{ x: 0, y: 0, w: 1, h: 1 }] }, 10).ok, true)

// Garbage is rejected, each with its own reason.
const bad = (patch: Record<string, unknown>, error: string, pageCount: number | null = 10) =>
  assert.deepEqual(parseHighlightInput({ ...ok, ...patch }, pageCount), { ok: false, error })
bad({ page: 0 }, 'page out of range')
bad({ page: 11 }, 'page out of range')
bad({ page: 2.5 }, 'page out of range')
bad({ page: '3' }, 'page out of range')
bad({ text: '   ' }, 'text must be 1..2000 chars')
bad({ text: 'a'.repeat(2001) }, 'text must be 1..2000 chars')
bad({ text: 5 }, 'text must be 1..2000 chars')
bad({ rects: [] }, 'invalid rects')
bad({ rects: Array(201).fill(rect) }, 'invalid rects')
bad({ rects: [{ ...rect, x: 1.01 }] }, 'invalid rects')
bad({ rects: [{ ...rect, y: -0.1 }] }, 'invalid rects')
bad({ rects: [{ ...rect, w: 0 }] }, 'invalid rects')
bad({ rects: [{ ...rect, h: 0 }] }, 'invalid rects')
bad({ rects: [{ ...rect, w: '0.5' }] }, 'invalid rects')
bad({ rects: [{ ...rect, w: NaN }] }, 'invalid rects')
bad({ rects: [null] }, 'invalid rects')
bad({ rects: 'x' }, 'invalid rects')
bad({ color: 'red' }, 'invalid color')
bad({ color: null }, 'invalid color')
bad({ note: 'b'.repeat(2001) }, 'invalid note')
bad({ note: 7 }, 'invalid note')
// A body that is not a JSON object has its own error (not "page out of range").
for (const b of [null, [], 'str', 5, undefined]) {
  assert.deepEqual(parseHighlightInput(b, 10), { ok: false, error: 'invalid body' })
  assert.deepEqual(parseHighlightPatch(b), { ok: false, error: 'invalid body' })
}
// x=1 with w>0 is allowed (only [0,1] per number is required); Infinity is not.
assert.equal(parseHighlightInput({ ...ok, rects: [{ x: 1, y: 0, w: 0.2, h: 0.1 }] }, 10).ok, true)
bad({ rects: [{ ...rect, w: Infinity }] }, 'invalid rects')
bad({ rects: [{ ...rect, x: -Infinity }] }, 'invalid rects')
// Whitespace around exactly 2000 chars: trimmed first, so valid; 2001 real chars + padding is not.
assert.equal(parseHighlightInput({ ...ok, text: '   ' + 'a'.repeat(2000) + '   ' }, 10).ok, true)
bad({ text: '   ' + 'a'.repeat(2001) }, 'text must be 1..2000 chars')
// Unknown page count: any page up to the generic book-size cap passes, 0 does not.
assert.equal(parseHighlightInput({ ...ok, page: 400 }, null).ok, true)
assert.equal(parseHighlightInput({ ...ok, page: 0 }, null).ok, false)

// Extra keys on a rect are dropped.
assert.deepEqual(parseRects([{ ...rect, evil: 1 }]), [rect])

// PATCH: only sent fields; null note clears; nothing useful -> error.
assert.deepEqual(parseHighlightPatch({ color: 'blue' }), { ok: true, data: { color: 'blue' } })
assert.deepEqual(parseHighlightPatch({ note: '  ' }), { ok: true, data: { note: null } })
assert.deepEqual(parseHighlightPatch({ note: null, color: 'green' }), { ok: true, data: { note: null, color: 'green' } })
assert.deepEqual(parseHighlightPatch({ note: ' x ' }), { ok: true, data: { note: 'x' } })
assert.deepEqual(parseHighlightPatch({}), { ok: false, error: 'note or color required' })
assert.deepEqual(parseHighlightPatch({ color: 'red' }), { ok: false, error: 'invalid color' })
assert.deepEqual(parseHighlightPatch({ note: 1 }), { ok: false, error: 'invalid note' })
assert.deepEqual(parseHighlightPatch({ note: 'c'.repeat(2001) }), { ok: false, error: 'invalid note' })

// Row -> API shape: ISO date, owner fields not leaked, unknown colour/broken rects degrade safely.
const row = { id: 'h1', fileId: 'f', ownerId: 'u', page: 3, text: 'т', rects: [rect], color: 'green', note: null, createdAt: new Date('2026-10-08T10:00:00Z') }
assert.deepEqual(toHighlight(row), { id: 'h1', page: 3, text: 'т', rects: [rect], color: 'green', note: null, createdAt: '2026-10-08T10:00:00.000Z' })
assert.deepEqual(toHighlight({ ...row, color: 'weird', rects: 'junk' }).rects, [])
assert.equal(toHighlight({ ...row, color: 'weird' }).color, 'yellow')

console.log('bookHighlights.selfcheck ok')
