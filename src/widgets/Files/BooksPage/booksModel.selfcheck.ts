// npx tsx src/widgets/Files/BooksPage/booksModel.selfcheck.ts — expected values worked out by hand.
import assert from 'node:assert/strict'
import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { bookCounts, continueBook, filterBooks, newBooks, newestIds, recentlyOpened, sortBooks } from './booksModel'

function book(id: string, title: string, added: string, o: { saved?: boolean; pct?: number; opened?: string; cover?: string | null } = {}): LibraryBook {
  return {
    id, title, teacherId: 't', teacherName: 'T', pageCount: 100, sizeBytes: 1, addedAt: added,
    cover: { kind: null, url: o.cover ?? null, spineColor: '#2f5aa8' }, saved: !!o.saved,
    progress: o.pct === undefined ? null : { lastPage: o.pct, pct: o.pct, updatedAt: o.opened! },
    sharedWith: [],
  }
}
// ids: A oldest … H newest. Opened: B (62%, Oct 10), C (8%, Oct 9), E (100%, Oct 12), F (14%, Oct 8)
const A = book('A', 'Алгебра', '2025-08-01T00:00:00Z', { saved: true })
const B = book('B', 'Биология', '2025-08-02T00:00:00Z', { pct: 62, opened: '2025-10-10T00:00:00Z', cover: 'u' })
const C = book('C', 'Химия', '2025-08-03T00:00:00Z', { pct: 8, opened: '2025-10-09T00:00:00Z', saved: true })
const D = book('D', 'Физика', '2025-08-04T00:00:00Z')
const E = book('E', 'География', '2025-08-05T00:00:00Z', { pct: 100, opened: '2025-10-12T00:00:00Z', cover: 'u' })
const F = book('F', 'Ботаника', '2025-08-06T00:00:00Z', { pct: 14, opened: '2025-10-08T00:00:00Z' })
const G = book('G', 'Лирика', '2025-08-07T00:00:00Z')
const H = book('H', 'Эпос', '2025-08-08T00:00:00Z')
const all = [A, B, C, D, E, F, G, H]
const ids = (l: LibraryBook[]) => l.map(b => b.id).join('')

// "Continue reading": E is the freshest but finished → B (Oct 10), not C/F.
assert.equal(continueBook(all)?.id, 'B')
assert.equal(continueBook([A, D]), null)
assert.equal(ids(recentlyOpened(all)), 'EBCF')

// 6 newest of 8 by addedAt: C D E F G H.
assert.equal([...newestIds(all)].sort().join(''), 'CDEFGH')
assert.equal(ids(filterBooks(all, 'new', '')), 'CDEFGH')
assert.equal(ids(newBooks(all)), 'HGFEDC')
assert.equal(ids(filterBooks(all, 'saved', '')), 'AC')
assert.equal(ids(filterBooks(all, 'withcover', '')), 'BE')
assert.equal(ids(filterBooks(all, 'needcover', '')), 'ACDFGH')
assert.equal(ids(filterBooks(all, 'done', '')), 'E')
// "Opened" = has progress: B, C, E, F in list order.
assert.equal(ids(filterBooks(all, 'opened', '')), 'BCEF')

// Search is by title, case-insensitive, trimmed; combines with the tab.
assert.equal(ids(filterBooks(all, 'all', '  ГЕО ')), 'E')
assert.equal(ids(filterBooks(all, 'saved', 'хим')), 'C')
assert.equal(ids(filterBooks(all, 'saved', 'zzz')), '')

// Sorting: recent = last opened, else added; ties of "never opened" fall back to newest added first.
assert.equal(ids(sortBooks(all, 'recent', 'ru')), 'EBCFHGDA')
// Titles (ru): Алгебра, Биология, Ботаника, География, Лирика, Физика, Химия, Эпос.
assert.equal(ids(sortBooks(all, 'title', 'ru')), 'ABFEGDCH')
// Progress desc E100 B62 F14 C8, then never opened by title: Алгебра, Лирика, Физика, Эпос.
assert.equal(ids(sortBooks(all, 'progress', 'ru')), 'EBFCAGDH')

// Empty library: nothing to continue, zero counters, no "new".
assert.equal(continueBook([]), null)
assert.deepEqual(bookCounts([]), { total: 0, saved: 0, fresh: 0 })
assert.equal(ids(newBooks([])), '')

// Fewer than 6 books: all of them are "new", newest first.
assert.equal(ids(newBooks([A, B])), 'BA')

// Same addedAt: ties go to the smaller id, whatever the input order (input is deliberately descending).
const same = ['g', 'f', 'e', 'd', 'c', 'b', 'a'].map(id => book(id, id, '2025-08-01T00:00:00Z'))
assert.equal([...newestIds(same)].sort().join(''), 'abcdef')
assert.equal(ids(newBooks(same)), 'abcdef')

// Equal sort keys fall back to the title (ru): Арбуз before Яблоко, although the input has them the other way round.
const yab = book('Y', 'Яблоко', '2025-08-01T00:00:00Z')
const arb = book('Z', 'Арбуз', '2025-08-01T00:00:00Z')
assert.equal(ids(sortBooks([yab, arb], 'recent', 'ru')), 'ZY')
const yab50 = book('Y', 'Яблоко', '2025-08-01T00:00:00Z', { pct: 50, opened: '2025-10-01T00:00:00Z' })
const arb50 = book('Z', 'Арбуз', '2025-08-01T00:00:00Z', { pct: 50, opened: '2025-10-01T00:00:00Z' })
assert.equal(ids(sortBooks([yab50, arb50], 'progress', 'ru')), 'ZY')
assert.equal(ids(sortBooks([yab50, arb50], 'recent', 'ru')), 'ZY')

assert.deepEqual(bookCounts(all), { total: 8, saved: 2, fresh: 6 })
assert.deepEqual(bookCounts([A]), { total: 1, saved: 1, fresh: 1 })
console.log('booksModel selfcheck: ok')

