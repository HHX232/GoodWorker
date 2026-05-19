import {CalendarEvent} from '@/shared/types/Calendar/calendar.types'

export const HOUR_HEIGHT = 56
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 23

export const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const HOURS = Array.from({length: DAY_END_HOUR - DAY_START_HOUR}, (_, i) => DAY_START_HOUR + i)

export const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
]

export const EVENT_COLORS: Record<string, {bg: string; title: string; time: string; border: string}> = {
  purple: {bg: '#EEEDFE', title: '#3C3489', time: '#534AB7', border: '#CECBF6'},
  teal: {bg: '#E1F5EE', title: '#085041', time: '#0F6E56', border: '#9FE1CB'},
  pink: {bg: '#FBEAF0', title: '#72243E', time: '#993556', border: '#F4C0D1'},
  amber: {bg: '#FAEEDA', title: '#633806', time: '#854F0B', border: '#FAC775'},
  blue: {bg: '#E6F1FB', title: '#0C447C', time: '#185FA5', border: '#B5D4F4'},
  coral: {bg: '#FAECE7', title: '#712B13', time: '#993C1D', border: '#F5C4B3'}
}

export function getWeekDays(referenceDate: Date): Date[] {
  const date = new Date(referenceDate)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(date)
    d.setDate(date.getDate() + i)
    return d
  })
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function getEventTop(startTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  const offsetMinutes = startMinutes - DAY_START_HOUR * 60
  return (offsetMinutes / 60) * HOUR_HEIGHT
}

export function getEventHeight(startTime: string, endTime: string): number {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime)
  return (duration / 60) * HOUR_HEIGHT
}

export function getCurrentTimeTop(): number {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const offsetMinutes = minutes - DAY_START_HOUR * 60
  if (offsetMinutes < 0) return 0
  const maxTop = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT
  return Math.min((offsetMinutes / 60) * HOUR_HEIGHT, maxTop)
}

export function getEventsForDay(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events.filter((e) => e.date === dateKey)
}

export function formatMonthYear(date: Date, locale = 'ru-RU'): string {
  return date.toLocaleDateString(locale, {month: 'long', year: 'numeric'})
}

export function getLocaleDayShorts(locale: string): string[] {
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const MONDAY_SEED = new Date(2024, 0, 1)
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(MONDAY_SEED)
    d.setDate(1 + i)
    return new Intl.DateTimeFormat(intlLocale, {weekday: 'short'}).format(d)
  })
}

export function roundToHalfHour(minutes: number): number {
  return Math.round(minutes / 30) * 30
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDateRu(dateStr: string, locale = 'ru-RU'): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, {day: 'numeric', month: 'long', year: 'numeric'})
}

export function eventsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = timeToMinutes(aStart)
  const aE = timeToMinutes(aEnd)
  const bS = timeToMinutes(bStart)
  const bE = timeToMinutes(bEnd)
  return aS < bE && aE > bS
}
