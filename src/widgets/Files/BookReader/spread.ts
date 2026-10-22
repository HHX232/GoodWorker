// Pure layout of the reader: which pages share the screen and where a
// reader-mark sits. Double view is a printed book: page 1 alone on the right,
// then (2·3), (4·5)…, even page left / odd page right.

export type ViewMode = 'single' | 'double'
export type Corner = 'left' | 'right'

/** Pages on screen, left to right; `null` = an empty slot (page 1's left, a last even page's right). */
export function spreadPages(page: number, mode: ViewMode, count: number): (number | null)[] {
  if (mode === 'single') return [page]
  if (page <= 1) return [null, 1]
  const left = page % 2 === 0 ? page : page - 1
  return [left, left + 1 <= count ? left + 1 : null]
}

/** Which top corner of the page its reader-mark takes: double → by the page's side, single → always left. */
export function cornerFor(page: number, mode: ViewMode): Corner {
  return mode === 'double' && page % 2 === 1 ? 'right' : 'left'
}

/**
 * The page to show after turning (`dir` ±1) or landing (`dir` 0: clamp + snap).
 * In double view the current page is the spread's left one (1, 2, 4, 6…).
 */
export function stepPage(page: number, dir: -1 | 0 | 1, mode: ViewMode, count: number): number {
  const clamp = (n: number) => Math.min(Math.max(1, n), Math.max(1, count))
  const snap = (n: number) => (mode === 'double' && n > 1 && n % 2 === 1 ? n - 1 : n)
  const cur = snap(clamp(page))
  if (dir === 0) return cur
  if (mode === 'single') return clamp(cur + dir)
  if (dir === 1) return snap(clamp(cur === 1 ? 2 : cur + 2))
  return cur <= 2 ? 1 : cur - 2
}
