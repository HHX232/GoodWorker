import type { AIUsage } from '@/lib/openrouter'

// ─── DeepSeek token rates, $ per 1,000,000 tokens ──────────────────────────
// Source: user-provided rate card (see .autopilot/wallet-balance/spec.md
// §"Ценообразование"). Same table used for the vision model too — no
// separate price was given for it (see spec "Открытые места").
const RATES = {
  nonPeak: { miss: 0.15, hit: 0.003, out: 0.6 },
  peak: { miss: 0.3, hit: 0.006, out: 1.2 },
} as const

/**
 * DeepSeek's official peak-pricing window: 01:00–04:00 UTC and 06:00–10:00
 * UTC, Monday–Friday. Everything else (including the whole weekend) is
 * non-peak. Chinese public holidays are NOT excluded from this window — known
 * limitation, see spec "Вне рамок" (effect: some real off-peak days during
 * holidays get billed at the peak rate for a few hours a year — never the
 * other way around, so it's not a loss for the user... it can occasionally
 * overcharge, but the spec explicitly accepts this gap rather than shipping a
 * holiday calendar dependency).
 */
export function isPeak(at: Date): boolean {
  const day = at.getUTCDay() // 0 = Sunday ... 6 = Saturday
  if (day === 0 || day === 6) return false
  const hour = at.getUTCHours()
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)
}

function markupMultiplier(markupPercent: number): number {
  return 1 + (Number.isFinite(markupPercent) ? markupPercent : 0) / 100
}

/**
 * Real cost of one AI call, in whole cents, always rounded UP (never in the
 * user's favor). `usage: null` means the provider didn't report token usage
 * (free OpenRouter fallback) — cost is unknowable, so it's treated as free
 * rather than guessed. `markupPercent` is caller-supplied (from
 * `getMarkupPercent()` in wallet.ts, backed by `WalletSettings`, editable
 * from the admin panel) — this function stays a pure function with no Prisma
 * access of its own.
 */
export function computeCostCents(usage: AIUsage, at: Date, markupPercent: number): number {
  if (usage === null) return 0

  const rates = isPeak(at) ? RATES.peak : RATES.nonPeak
  const dollars =
    (usage.promptCacheMissTokens * rates.miss +
      usage.promptCacheHitTokens * rates.hit +
      usage.completionTokens * rates.out) /
    1_000_000

  return Math.ceil(dollars * 100 * markupMultiplier(markupPercent))
}

// Conservative chars→tokens ratio for the preflight upper bound — fewer chars
// per token than typical (~4) so the estimate skews toward "more tokens than
// reality", never fewer.
const CHARS_PER_TOKEN_ESTIMATE = 3

/**
 * Output-token ceiling per endpoint, used only for the preflight upper-bound
 * estimate below — not measured on real traffic yet (see spec "Открытые
 * места"). Keyed by the same path fragment tickets 02/03 will pass in when
 * they wire preflight/charge into these 7 routes.
 */
const OUTPUT_TOKEN_CEILING: Record<string, number> = {
  'whiteboard/formula-ai': 200, // short LaTeX snippet
  'whiteboard/formula-photo': 400, // LaTeX, or a few candidate LaTeX strings
  'pdf-to-test/photos': 6000, // up to 60 quiz questions as JSON
  'pdf-to-test': 6000, // up to 60 quiz questions as JSON (VIP "unlimited" mode)
  'tests/import-pdf': 5000, // up to 30 rich test blocks as JSON, per chunk
  'teacher/lesson-plan': 2000, // structured JSON lesson plan
  'teacher/lesson-plan/revise': 2000, // same shape, revised
}
const DEFAULT_OUTPUT_TOKEN_CEILING = 2000

/**
 * Upper-bound cost estimate for the preflight check (R14i.1) — done BEFORE
 * calling the AI provider, so a request that's obviously unaffordable never
 * reaches DeepSeek. Treats the whole prompt as cache-miss input (the more
 * expensive case) plus a fixed output-token ceiling for the endpoint; always
 * priced at whatever `isPeak(at)` says for the moment of the request.
 */
export function estimateMaxCostCents(endpoint: string, promptChars: number, at: Date, markupPercent: number): number {
  const promptTokens = Math.ceil(promptChars / CHARS_PER_TOKEN_ESTIMATE)
  const outputCeiling = OUTPUT_TOKEN_CEILING[endpoint] ?? DEFAULT_OUTPUT_TOKEN_CEILING
  const usage: AIUsage = { promptCacheHitTokens: 0, promptCacheMissTokens: promptTokens, completionTokens: outputCeiling }
  return computeCostCents(usage, at, markupPercent)
}
