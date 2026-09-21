// Self-check for pricing.ts — run with `npx tsx src/shared/lib/wallet/pricing.selfcheck.ts`.
// No test runner in this project; expected numbers below are computed BY HAND
// from the rate card in spec.md, not derived from computeCostCents itself.
import { computeCostCents, isPeak } from './pricing'

let failures = 0
function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    failures++
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

// 2026-09-21 is a Monday, 2026-09-19 is a Saturday (verified via Date#getUTCDay).
const MON_PEAK_AM = new Date('2026-09-21T02:00:00Z') // inside 01:00-04:00
const MON_GAP = new Date('2026-09-21T05:00:00Z') // between the two peak windows
const MON_PEAK_MORNING = new Date('2026-09-21T08:00:00Z') // inside 06:00-10:00
const MON_NONPEAK = new Date('2026-09-19T12:00:00Z') // Saturday — weekend, always non-peak

assertEqual(isPeak(MON_PEAK_AM) ? 1 : 0, 1, 'isPeak: Monday 02:00 UTC is peak')
assertEqual(isPeak(MON_GAP) ? 1 : 0, 0, 'isPeak: Monday 05:00 UTC is non-peak (gap between windows)')
assertEqual(isPeak(MON_PEAK_MORNING) ? 1 : 0, 1, 'isPeak: Monday 08:00 UTC is peak')
assertEqual(isPeak(MON_NONPEAK) ? 1 : 0, 0, 'isPeak: Saturday is always non-peak')

delete process.env.AI_MARKUP_PERCENT

// Non-peak, cache-miss: 2,000,000 tokens @ $0.15/1M = $0.30 -> 30 cents.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 2_000_000, promptCacheHitTokens: 0, completionTokens: 0 }, MON_NONPEAK),
  30,
  'computeCostCents: non-peak cache-miss',
)

// Peak, cache-miss: 2,000,000 tokens @ $0.30/1M = $0.60 -> 60 cents.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 2_000_000, promptCacheHitTokens: 0, completionTokens: 0 }, MON_PEAK_AM),
  60,
  'computeCostCents: peak cache-miss',
)

// Non-peak, cache-hit: 10,000,000 tokens @ $0.003/1M = $0.03 -> 3 cents.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 0, promptCacheHitTokens: 10_000_000, completionTokens: 0 }, MON_NONPEAK),
  3,
  'computeCostCents: non-peak cache-hit',
)

// Peak, cache-hit: 10,000,000 tokens @ $0.006/1M = $0.06 -> 6 cents.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 0, promptCacheHitTokens: 10_000_000, completionTokens: 0 }, MON_PEAK_MORNING),
  6,
  'computeCostCents: peak cache-hit',
)

// Rounding: 1 output token @ $0.60/1M = $0.0000006 -> must round UP to 1 cent, not 0.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 0, promptCacheHitTokens: 0, completionTokens: 1 }, MON_NONPEAK),
  1,
  'computeCostCents: rounds up to a whole cent, never down',
)

// usage === null (no usage reported by provider) -> free.
assertEqual(computeCostCents(null, MON_PEAK_AM), 0, 'computeCostCents: null usage is free')

// Markup: same non-peak cache-miss call as above ($0.30 base) with +50% markup -> $0.45 -> 45 cents.
process.env.AI_MARKUP_PERCENT = '50'
assertEqual(
  computeCostCents({ promptCacheMissTokens: 2_000_000, promptCacheHitTokens: 0, completionTokens: 0 }, MON_NONPEAK),
  45,
  'computeCostCents: 50% markup applied on top of cost',
)
delete process.env.AI_MARKUP_PERCENT

// Unset AI_MARKUP_PERCENT (no env var at all) behaves as 0%, not an error/NaN.
assertEqual(
  computeCostCents({ promptCacheMissTokens: 2_000_000, promptCacheHitTokens: 0, completionTokens: 0 }, MON_NONPEAK),
  30,
  'computeCostCents: unset AI_MARKUP_PERCENT means 0% markup',
)

if (failures > 0) {
  console.error(`pricing.selfcheck: ${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('pricing.selfcheck: all checks passed')
