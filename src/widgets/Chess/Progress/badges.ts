import { BADGE_CODES, POINT_STEPS } from '@/shared/lib/chess/server/progressModel'

export type BadgeGroup = 'bot' | 'points' | 'streak' | 'storm' | 'online'
export const BADGE_GROUPS: BadgeGroup[] = ['bot', 'points', 'streak', 'storm', 'online']

/** Код значка → группа и ключи `chess.progress` с параметрами. */
export function badgeText(code: string): { group: BadgeGroup; nameKey: string; hintKey: string; values: { n: number } } {
  const n = Number(code.match(/\d+$/)?.[0] ?? 0)
  if (code.startsWith('first_win_l')) return { group: 'bot', nameKey: 'b_first_win', hintKey: 'h_first_win', values: { n } }
  if (code.startsWith('points_')) return { group: 'points', nameKey: 'b_points', hintKey: 'h_points', values: { n } }
  if (code.startsWith('streak_')) return { group: 'streak', nameKey: 'b_streak', hintKey: 'h_streak', values: { n } }
  if (code.startsWith('storm_')) return { group: 'storm', nameKey: 'b_storm', hintKey: 'h_storm', values: { n } }
  return { group: 'online', nameKey: 'b_online_first_win', hintKey: 'h_online_first_win', values: { n } }
}

export const codesOf = (group: BadgeGroup) => BADGE_CODES.filter((c) => badgeText(c).group === group)

/** Следующий порог очков или null, если все получены. */
export const nextPointStep = (points: number) => POINT_STEPS.find((s) => s > points) ?? null
