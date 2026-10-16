// Рейтинг задач (spec §R05.3): Elo K=32 по рейтингу задачи; подбор окна ±150, расширяется ×2 до 3 раз.

export const GUEST_PUZZLE_RATING = 1200
const K = 32
const BASE_WINDOW = 150
const WIDENINGS = 3

export function nextPuzzleRating(userRating: number, puzzleRating: number, solved: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - userRating) / 400))
  return Math.round(userRating + K * ((solved ? 1 : 0) - expected))
}

/** Окна подбора по порядку: первое непустое — откуда брать задачу. */
export function ratingWindows(rating: number): { min: number; max: number }[] {
  return Array.from({ length: WIDENINGS + 1 }, (_, i) => {
    const w = BASE_WINDOW * 2 ** i
    return { min: Math.max(0, rating - w), max: rating + w }
  })
}
