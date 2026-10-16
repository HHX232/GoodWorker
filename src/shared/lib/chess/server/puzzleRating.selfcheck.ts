// npx tsx src/shared/lib/chess/server/puzzleRating.selfcheck.ts → "puzzleRating ok"
import assert from 'node:assert/strict'
import { nextPuzzleRating, ratingWindows } from './puzzleRating'

// Elo K=32, ожидания посчитаны вручную: E = 1 / (1 + 10^((Rp − Ru)/400))
assert.equal(nextPuzzleRating(1200, 1200, true), 1216) // E=0.5 → +16
assert.equal(nextPuzzleRating(1200, 1200, false), 1184)
assert.equal(nextPuzzleRating(1500, 1100, true), 1503) // E=10/11 → +2.9
assert.equal(nextPuzzleRating(1500, 1100, false), 1471) // −29.1
assert.equal(nextPuzzleRating(1100, 1500, true), 1129) // E=1/11 → +29.1

// окно ±150, расширяется ×2 до 3 раз
assert.deepEqual(ratingWindows(1200), [
  { min: 1050, max: 1350 },
  { min: 900, max: 1500 },
  { min: 600, max: 1800 },
  { min: 0, max: 2400 },
])

console.log('puzzleRating ok')
