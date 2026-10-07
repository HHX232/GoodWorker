// Self-check for the pure book logic (bookModel.ts). No test runner in this
// project (see CLAUDE.md): `npx tsx src/shared/lib/tutorFiles/books.selfcheck.ts`.
// Expected values are worked out by hand, not by the code under test.
import assert from 'node:assert/strict'
import { bookPct, buildPresence, clampPageCount, coverKeyOf, defaultSpineColor, isPageInRange, parseCoverKind, parseSpineColor, toBook } from './bookModel'

// 31-hash by hand: "ab" = 97*31 + 98 = 3105 -> mod 10 = 5 -> #c79a2e;
// "abc" = 3105*31 + 99 = 96354 -> 4 -> #6a4fb3; "я" = 1103 -> 3 -> #3f7d5b; "" = 0 -> #2f5aa8.
assert.equal(defaultSpineColor('ab'), '#c79a2e')
assert.equal(defaultSpineColor('abc'), '#6a4fb3')
assert.equal(defaultSpineColor('я'), '#3f7d5b')
assert.equal(defaultSpineColor(''), '#2f5aa8')

// toBook: no custom title -> file name without .pdf; no cover -> typographic (kind/url null) + the title's default colour.
const base = { id: 'f1', teacherId: 't1', sizeBytes: 1000, createdAt: new Date('2026-10-05T10:00:00Z'), pageCount: 214 as number | null }
const plain = toBook(
  { ...base, name: 'ab.pdf', bookTitle: null, coverUrl: null, coverKind: 'found', spineColor: null },
  { teacherName: 'Анна', saved: true, progress: { lastPage: 134, updatedAt: new Date('2026-10-06T08:00:00Z') }, sharedWith: [] },
)
assert.equal(plain.title, 'ab')
assert.deepEqual(plain.cover, { kind: null, url: null, spineColor: '#c79a2e' })
assert.equal(plain.addedAt, '2026-10-05T10:00:00.000Z')
assert.equal(plain.saved, true)
// 134 of 214 pages = 62.6% -> 63
assert.deepEqual(plain.progress, { lastPage: 134, pct: 63, updatedAt: '2026-10-06T08:00:00.000Z' })

// Own title, photo cover and colour win; unknown page count -> pct 0; a last page past the end -> 100, never above.
const custom = toBook(
  { ...base, name: 'x.pdf', bookTitle: 'Своё', pageCount: null, coverUrl: 'https://s/c.jpg', coverKind: 'photo', spineColor: '#112233' },
  { teacherName: 'Анна', saved: false, progress: { lastPage: 9, updatedAt: new Date('2026-10-06T08:00:00Z') }, sharedWith: [] },
)
assert.equal(custom.title, 'Своё')
assert.deepEqual(custom.cover, { kind: 'photo', url: 'https://s/c.jpg', spineColor: '#112233' })
assert.equal(custom.progress?.pct, 0)
const over = toBook(
  { ...base, name: 'x.pdf', bookTitle: null, coverUrl: null, coverKind: null, spineColor: null, pageCount: 10 },
  { teacherName: 'Анна', saved: false, progress: { lastPage: 12, updatedAt: new Date('2026-10-06T08:00:00Z') }, sharedWith: [] },
)
assert.equal(over.progress?.pct, 100)
assert.equal(toBook({ ...base, name: 'x.pdf', bookTitle: null, coverUrl: null, coverKind: null, spineColor: null }, { teacherName: 'Анна', saved: false, progress: null, sharedWith: [] }).progress, null)

// buildPresence: s1 and s2 both stopped on page 10 (s2 later), s3 on page 3. Earlier pages go to readBy, newest first;
// a student who stopped on a page is listed there only in stoppedHere; a student no longer in `people` is dropped.
const D = (s: string) => new Date(`2026-10-${s}:00Z`)
const people = new Map(['s1', 's2', 's3'].map(id => [id, { id, name: `N-${id}`, avatarUrl: null }]))
const pres = buildPresence(
  [
    { studentId: 's1', lastPage: 10, updatedAt: D('05T21:14') },
    { studentId: 's2', lastPage: 10, updatedAt: D('06T09:00') },
    { studentId: 's3', lastPage: 3, updatedAt: D('04T10:00') },
    { studentId: 'gone', lastPage: 10, updatedAt: D('04T10:00') },
  ],
  [
    { studentId: 's1', page: 8, lastReadAt: D('05T21:00') },
    { studentId: 's1', page: 9, lastReadAt: D('05T21:10') },
    { studentId: 's1', page: 10, lastReadAt: D('05T21:14') },
    { studentId: 's2', page: 9, lastReadAt: D('06T08:50') },
    { studentId: 's2', page: 10, lastReadAt: D('06T09:00') },
    { studentId: 's3', page: 2, lastReadAt: D('04T09:55') },
    { studentId: 's3', page: 3, lastReadAt: D('04T10:00') },
  ],
  people,
)
assert.deepEqual(Object.keys(pres.pages).sort((a, b) => Number(a) - Number(b)), ['2', '3', '8', '9', '10'])
assert.deepEqual(pres.pages[10].stoppedHere.map(p => [p.id, p.stoppedAt]), [['s2', '2026-10-06T09:00:00.000Z'], ['s1', '2026-10-05T21:14:00.000Z']])
assert.deepEqual(pres.pages[10].readBy, [])
assert.deepEqual(pres.pages[9].stoppedHere, [])
assert.deepEqual(pres.pages[9].readBy.map(r => [r.person.id, r.lastReadAt]), [['s2', '2026-10-06T08:50:00.000Z'], ['s1', '2026-10-05T21:10:00.000Z']])
assert.deepEqual(pres.pages[8].readBy.map(r => r.person.id), ['s1'])
assert.deepEqual(pres.pages[3].stoppedHere.map(p => p.id), ['s3'])
assert.deepEqual(pres.pages[2].readBy.map(r => r.person.id), ['s3'])
assert.deepEqual(buildPresence([], [], people), { pages: {} })

// Input guards: what is accepted and what is rejected.
// Page count is clamped, not refused: 0 -> 1, 5001 -> 5000, 3.4 -> 3 (rounded), junk/absent -> null.
assert.equal(clampPageCount(0), 1)
assert.equal(clampPageCount(1), 1)
assert.equal(clampPageCount(5000), 5000)
assert.equal(clampPageCount(5001), 5000)
assert.equal(clampPageCount(3.4), 3)
assert.equal(clampPageCount('12'), 12)
assert.equal(clampPageCount('abc'), null)
assert.equal(clampPageCount(null), null)
assert.equal(clampPageCount(undefined), null)

// Colour: exactly '#' + 6 hex digits (either case), stored lower-case.
assert.equal(parseSpineColor('#1a2B3c'), '#1a2b3c')
assert.equal(parseSpineColor('abc'), null)
assert.equal(parseSpineColor('#12345'), null)
assert.equal(parseSpineColor('#GGGGGG'), null)
assert.equal(parseSpineColor(123), null)

assert.equal(parseCoverKind('photo'), 'photo')
assert.equal(parseCoverKind('screenshot'), null)

// Page range: 1…pageCount, or 1…5000 when the count is unknown; whole numbers only.
assert.equal(isPageInRange(1, 10), true)
assert.equal(isPageInRange(10, 10), true)
assert.equal(isPageInRange(11, 10), false)
assert.equal(isPageInRange(0, 10), false)
assert.equal(isPageInRange(1.5, 10), false)
assert.equal(isPageInRange('3', 10), false)
assert.equal(isPageInRange(5000, null), true)
assert.equal(isPageInRange(5001, null), false)

// Progress: 134/214 = 62.6% -> 63; 1/214 = 0.47% -> 0; unknown count -> 0; past the end -> 100.
assert.equal(bookPct(134, 214), 63)
assert.equal(bookPct(1, 214), 0)
assert.equal(bookPct(5, null), 0)
assert.equal(bookPct(12, 10), 100)

// Cover object keys: only our own covers resolve; anything else is left alone and the refusal is logged.
const logged: unknown[][] = []
const realError = console.error
console.error = (...a: unknown[]) => { logged.push(a) }
try {
  const base = 'https://cdn.x/pub/'
  assert.equal(coverKeyOf('https://cdn.x/pub/tutor-files/t1/covers/u1.png', base), 'tutor-files/t1/covers/u1.png')
  assert.equal(logged.length, 0)
  assert.equal(coverKeyOf('https://evil.example/tutor-files/t1/covers/u1.png', base), null) // foreign host
  assert.equal(logged.length, 1)
  assert.equal(coverKeyOf('https://cdn.x/pub/tutor-files/t1/u1.pdf', base), null) // a book's PDF is never a cover
  assert.equal(logged.length, 2)
  assert.equal(coverKeyOf('https://cdn.x/pub/tutor-files/t1/covers/u1.png', undefined), null) // no public base configured
  assert.equal(logged.length, 3)
} finally {
  console.error = realError
}

// A cover whose kind is unknown keeps its image but is not labelled found/page1/photo.
const odd = toBook(
  { ...base, name: 'x.pdf', bookTitle: 'T', coverUrl: 'https://s/c.jpg', coverKind: 'screenshot', spineColor: null },
  { teacherName: 'Анна', saved: false, progress: null, sharedWith: [] },
)
assert.equal(odd.cover.url, 'https://s/c.jpg')
assert.equal(odd.cover.kind, null)
// "T" = 84 -> 84 % 10 = 4 -> #6a4fb3
assert.equal(odd.cover.spineColor, '#6a4fb3')

console.log('books selfcheck: ok')
