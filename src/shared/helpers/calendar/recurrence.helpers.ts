import { RRule, Weekday } from 'rrule'

// Hard ceiling on generated occurrences — protects the JSON-blob calendar
// storage and the UI from pathological input (e.g. daily recurrence with a
// far-future until-date).
export const MAX_RECURRENCE_OCCURRENCES = 200

export interface RecurrenceInput {
  freq: 'daily' | 'weekly' | 'monthly'
  interval: number
  byWeekday?: number[] // 0=Mon..6=Sun
  endType: 'count' | 'until'
  count?: number
  until?: string // 'YYYY-MM-DD'
  startDate: string // 'YYYY-MM-DD' — the first occurrence's date
}

const FREQ_MAP = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY } as const
const RRULE_WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Picks the right plural form for a count. Russian has 3 forms (один/one,
 * два-четыре/few, пять+/many); other locales fall back to a simple
 * singular/plural split (the "few" form is unused there). */
export function pluralize(locale: string, n: number, forms: [one: string, few: string, many: string]): string {
  const [one, few, many] = forms
  if (locale === 'ru') {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return one
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
    return many
  }
  return n === 1 ? one : many
}

export function generateRecurrenceDates(input: RecurrenceInput): string[] {
  const dtstart = parseLocalDate(input.startDate)

  const options: ConstructorParameters<typeof RRule>[0] = {
    freq: FREQ_MAP[input.freq],
    interval: Math.max(1, input.interval),
    dtstart,
  }

  if (input.freq === 'weekly' && input.byWeekday?.length) {
    options.byweekday = input.byWeekday.map((i) => RRULE_WEEKDAYS[i]) as Weekday[]
  }

  if (input.endType === 'count') {
    options.count = Math.min(Math.max(1, input.count ?? 8), MAX_RECURRENCE_OCCURRENCES)
  } else if (input.until) {
    options.until = parseLocalDate(input.until)
  }

  const rule = new RRule(options)
  const occurrences =
    input.endType === 'until'
      ? rule.all((_date, i) => i < MAX_RECURRENCE_OCCURRENCES)
      : rule.all()

  return occurrences.map(formatLocalDate)
}
