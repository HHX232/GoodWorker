// Puzzle storm: pure clock/score rules. The page owns puzzles and the board; this owns when the run ends.
export type StormMode = 3 | 5
export type StormState = {
  mode: StormMode
  startedAt: number
  penaltyMs: number
  errors: number
  score: number
  over: boolean
  reason: 'time' | 'errors' | null
  /** moment the run ended: the clock is frozen there */
  endedAt: number | null
}

export const STORM_PENALTY_MS = 10_000
export const STORM_MAX_ERRORS = 3
const START_RATING = 800
const RATING_STEP = 50

export const startStorm = (mode: StormMode, now: number): StormState => ({
  mode,
  startedAt: now,
  penaltyMs: 0,
  errors: 0,
  score: 0,
  over: false,
  reason: null,
  endedAt: null,
})

export function timeLeftMs(s: StormState, now: number): number {
  const at = s.endedAt ?? now
  return Math.max(0, s.mode * 60_000 - s.penaltyMs - (at - s.startedAt))
}

/** Ends the run when the clock has run out. */
export const tick = (s: StormState, now: number): StormState =>
  !s.over && timeLeftMs(s, now) <= 0 ? { ...s, over: true, reason: 'time', endedAt: now } : s

export function solve(s: StormState, now: number): StormState {
  const t = tick(s, now)
  return t.over ? t : { ...t, score: t.score + 1 }
}

export function miss(s: StormState, now: number): StormState {
  const t = tick(s, now)
  if (t.over) return t
  const next = tick({ ...t, errors: t.errors + 1, penaltyMs: t.penaltyMs + STORM_PENALTY_MS }, now)
  return next.over || next.errors < STORM_MAX_ERRORS ? next : { ...next, over: true, reason: 'errors', endedAt: now }
}

/** `minRating` for the n-th puzzle of a run (0-based, solved or missed). */
export const stormMinRating = (index: number) => START_RATING + index * RATING_STEP
