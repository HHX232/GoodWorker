// Чистое ядро прогресса (T11): серия-огонёк, очки за ботов, значки, дни VIP. Без Prisma — проверяется progress.selfcheck.ts.

export type ActivityKind = 'bot' | 'online' | 'puzzle' | 'storm'
export type GameResult = 'win' | 'draw' | 'loss'
export type ActivityInput = {
  kind: ActivityKind
  tzOffsetMin: number // Date#getTimezoneOffset() клиента: UTC − местное, минуты (Москва −180)
  botLevel?: number // 1..8, только bot
  result?: GameResult // bot / online
  plies?: number // полуходов в партии (bot)
  score?: number // storm: решено задач
}
export type ProgressState = {
  botPoints: number
  streakCurrent: number
  streakBest: number
  lastActiveDay: string | null
  tzOffsetMin: number | null // пояс, в котором считаются дни; фиксируется на сутки
  tzSetAt: string | null // ISO-время фиксации пояса
  pointsDay: string | null // день (в поясе пользователя), к которому относится pointsToday
  pointsToday: number
}

export const EMPTY_PROGRESS: ProgressState = {
  botPoints: 0,
  streakCurrent: 0,
  streakBest: 0,
  lastActiveDay: null,
  tzOffsetMin: null,
  tzSetAt: null,
  pointsDay: null,
  pointsToday: 0,
}

/** YYYY-MM-DD в часовом поясе клиента. */
export function localDay(now: Date, tzOffsetMin: number): string {
  return new Date(now.getTime() - tzOffsetMin * 60_000).toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000
const dayNum = (d: string) => Date.parse(d + 'T00:00:00Z') / DAY_MS

export const POINT_STEPS = [100, 500, 1000, 2500, 5000] as const
export const STREAK_STEPS = [3, 7, 30, 100] as const
export const STORM_STEPS = [10, 20] as const
export const BOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const

/** Все значки в порядке показа. */
export const BADGE_CODES: readonly string[] = [
  ...BOT_LEVELS.map((l) => `first_win_l${l}`),
  ...POINT_STEPS.map((n) => `points_${n}`),
  ...STREAK_STEPS.map((n) => `streak_${n}`),
  ...STORM_STEPS.map((n) => `storm_${n}`),
  'online_first_win',
]

/** Условия, выполненные после активности (без учёта уже полученных). */
function earnedCodes(next: ProgressState, input: ActivityInput): string[] {
  const out: string[] = []
  if (input.kind === 'bot' && input.result === 'win' && input.botLevel) out.push(`first_win_l${input.botLevel}`)
  if (input.kind === 'online' && input.result === 'win') out.push('online_first_win')
  for (const n of POINT_STEPS) if (next.botPoints >= n) out.push(`points_${n}`)
  for (const n of STREAK_STEPS) if (next.streakCurrent >= n) out.push(`streak_${n}`)
  if (input.kind === 'storm') for (const n of STORM_STEPS) if ((input.score ?? 0) >= n) out.push(`storm_${n}`)
  return out
}

export const MIN_BOT_PLIES = 10 // защита от фарма: короче — партия не засчитывается
export const DAILY_BOT_POINTS_CAP = 300 // очков за ботов в сутки (в поясе пользователя), сверх — не начисляются
const TZ_LOCK_MS = DAY_MS // пояс меняется не чаще раза в сутки: иначе прыжок UTC−12 → UTC+14 даёт «новый день» без ожидания

function botPointsFor(input: ActivityInput): number {
  if (input.kind !== 'bot' || !input.botLevel) return 0
  return input.result === 'win' ? 10 * input.botLevel : input.result === 'draw' ? 5 * input.botLevel : 0
}

export function applyActivity(state: ProgressState, owned: readonly string[], input: ActivityInput, now: Date) {
  if (input.kind === 'bot' && (input.plies ?? 0) < MIN_BOT_PLIES) {
    return { next: state, counted: false, streakChanged: false, newBadges: [] as string[] }
  }
  const tzLocked = state.tzOffsetMin !== null && state.tzSetAt !== null && now.getTime() - Date.parse(state.tzSetAt) < TZ_LOCK_MS
  const tz = tzLocked || state.tzOffsetMin === input.tzOffsetMin ? state.tzOffsetMin! : input.tzOffsetMin
  const tzChanged = tz !== state.tzOffsetMin
  const today = localDay(now, tz)
  const pointsToday = state.pointsDay === today ? state.pointsToday : 0
  const gained = Math.min(botPointsFor(input), Math.max(0, DAILY_BOT_POINTS_CAP - pointsToday))
  const last = state.lastActiveDay
  // тот же день или «вчера назад» после смены пояса на запад — без изменений; вчера — +1; иначе — 1
  const streakCurrent = last && dayNum(today) <= dayNum(last) ? state.streakCurrent : last && dayNum(today) - dayNum(last) === 1 ? state.streakCurrent + 1 : 1
  const streakChanged = streakCurrent !== state.streakCurrent
  const next: ProgressState = {
    ...state,
    botPoints: state.botPoints + gained,
    pointsDay: today,
    pointsToday: pointsToday + gained,
    tzOffsetMin: tz,
    tzSetAt: tzChanged ? now.toISOString() : state.tzSetAt,
    streakCurrent,
    streakBest: Math.max(state.streakBest, streakCurrent),
    lastActiveDay: last && dayNum(today) < dayNum(last) ? last : today,
  }
  const have = new Set(owned)
  const newBadges = earnedCodes(next, input).filter((c) => !have.has(c))
  return { next, counted: true, streakChanged, newBadges }
}

/**
 * G13.1 — дни VIP за значок. ПЛЕЙСХОЛДЕР: числа впишет пользователь; `null` — VIP не начисляется.
 * ПРАВИЛО: VIP назначать только значкам, условие которых сервер проверяет сам — `online_first_win` (партия на сервере, T12),
 * `storm_*` (только когда шторм считается на сервере, T13). Значки из клиентских данных (`first_win_*`, `points_*`, `streak_*` —
 * партия с ботом и решебник идут в браузере) подделываются запросом; им — только небольшие числа и только пока действует
 * DAILY_BOT_POINTS_CAP, иначе VIP фармится скриптом.
 * `online_first_win` тоже набивается вторым аккаунтом (сдача соперника на 3-м полуходе): прежде чем давать ему VIP, добавить
 * антифарм-условие при выдаче — минимум ходов в партии и соперник с установившимся рейтингом (ratingGames ≥ N).
 */
export const VIP_REWARDS: Record<string, number | null> = Object.fromEntries(BADGE_CODES.map((c) => [c, null]))

/** Сумма дней VIP за только что полученные значки. */
export function vipDaysFor(newBadges: readonly string[], rewards: Record<string, number | null> = VIP_REWARDS): number {
  return newBadges.reduce((sum, c) => sum + (rewards[c] ?? 0), 0)
}

/**
 * Новый срок VIP после награды или null — срок не меняется: бессрочный VIP (isVip без даты) не превращаем в срочный.
 * Неактивный/истёкший VIP продлевается от «сейчас», действующий — от его конца.
 */
export function vipExpiryAfterReward(cur: { isVip: boolean; vipExpiresAt: Date | null }, days: number, now: Date): Date | null {
  if (cur.isVip && !cur.vipExpiresAt) return null
  return extendVipExpiry(cur.vipExpiresAt, days, now)
}

/** Тот же расчёт, что в applyPromoCode/applyReferralCode: продлеваем действующий срок, истёкший — от «сейчас». */
export function extendVipExpiry(current: Date | null | undefined, days: number, now: Date): Date {
  const base = current && current > now ? current : now
  return new Date(base.getTime() + days * DAY_MS)
}

/** Огонёк: `today` — сегодня уже играл, `threat` — последний раз вчера (сыграй сегодня, иначе серия сгорит), `broken` — серии нет. */
export function streakState(lastActiveDay: string | null, today: string): 'today' | 'threat' | 'broken' {
  if (!lastActiveDay) return 'broken'
  const gap = dayNum(today) - dayNum(lastActiveDay)
  return gap <= 0 ? 'today' : gap === 1 ? 'threat' : 'broken'
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const RESULTS: readonly unknown[] = ['win', 'draw', 'loss']

/** Тело POST /api/chess/activity → вход или null (400). Поля, не относящиеся к виду активности, отбрасываются. */
export function parseActivity(body: unknown): ActivityInput | null {
  const b = body as Record<string, unknown> | null
  if (!b || typeof b !== 'object' || !isInt(b.tzOffsetMin, -840, 720)) return null
  const tzOffsetMin = b.tzOffsetMin
  switch (b.kind) {
    case 'puzzle':
      return { kind: 'puzzle', tzOffsetMin }
    case 'storm':
      return isInt(b.score, 0, 1000) ? { kind: 'storm', tzOffsetMin, score: b.score } : null
    case 'online':
      return RESULTS.includes(b.result) ? { kind: 'online', tzOffsetMin, result: b.result as GameResult } : null
    case 'bot':
      return isInt(b.botLevel, 1, 8) && RESULTS.includes(b.result) && isInt(b.plies, 0, 10_000)
        ? { kind: 'bot', tzOffsetMin, botLevel: b.botLevel, result: b.result as GameResult, plies: b.plies }
        : null
    default:
      return null
  }
}
