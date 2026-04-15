'use client'
import Image from 'next/image'
import {useMemo, useRef, useState} from 'react'
import styles from './WeekCalendar.module.scss'

interface Lesson {
  id: string
  studentName: string
  studentAvatar: string
  subject: string
  time: string
  duration: number
  date: Date
}

const today = new Date(2024, 8, 24)

const mockLessons: Lesson[] = [
  {
    id: '1',
    studentName: 'Алексей М.',
    studentAvatar: 'https://i.pravatar.cc/40?img=11',
    subject: 'Алгебра',
    time: '09:00',
    duration: 60,
    date: new Date(2024, 8, 24)
  },
  {
    id: '2',
    studentName: 'Мария К.',
    studentAvatar: 'https://i.pravatar.cc/40?img=20',
    subject: 'Геометрия',
    time: '11:30',
    duration: 90,
    date: new Date(2024, 8, 24)
  },
  {
    id: '3',
    studentName: 'Денис В.',
    studentAvatar: 'https://i.pravatar.cc/40?img=33',
    subject: 'Математика ЕГЭ',
    time: '14:00',
    duration: 60,
    date: new Date(2024, 8, 25)
  },
  {
    id: '4',
    studentName: 'Ольга Р.',
    studentAvatar: 'https://i.pravatar.cc/40?img=45',
    subject: 'Алгебра',
    time: '10:00',
    duration: 60,
    date: new Date(2024, 8, 26)
  },
  {
    id: '5',
    studentName: 'Иван С.',
    studentAvatar: 'https://i.pravatar.cc/40?img=52',
    subject: 'Тригонометрия',
    time: '16:00',
    duration: 90,
    date: new Date(2024, 8, 27)
  },
  {
    id: '6',
    studentName: 'Алексей М.',
    studentAvatar: 'https://i.pravatar.cc/40?img=11',
    subject: 'Алгебра',
    time: '09:00',
    duration: 60,
    date: new Date(2024, 8, 28)
  },
  {
    id: '7',
    studentName: 'Мария К.',
    studentAvatar: 'https://i.pravatar.cc/40?img=20',
    subject: 'Геометрия',
    time: '15:30',
    duration: 45,
    date: new Date(2024, 8, 28)
  }
]

const WEEK_DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const START_HOUR = 8
const END_HOUR = 20
const TOTAL_HOURS = END_HOUR - START_HOUR
const HOUR_HEIGHT = 72
const HOUR_HEIGHT_EMPTY = 38
const COL_FLEX_BUSY = 2
const COL_FLEX_EMPTY = 0.45

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatEndTime(time: string, duration: number) {
  const t = timeToMinutes(time) + duration
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`
}

function buildHourMap(weekLessons: Lesson[], weekDays: Date[]) {
  const occupiedHours = new Set<number>()
  for (const l of weekLessons) {
    if (!weekDays.some((d) => isSameDay(d, l.date))) continue
    const s = Math.floor(timeToMinutes(l.time) / 60)
    const e = Math.ceil((timeToMinutes(l.time) + l.duration) / 60)
    for (let h = s; h < e; h++) occupiedHours.add(h)
  }

  const tops: number[] = []
  let acc = 0
  for (let i = 0; i <= TOTAL_HOURS; i++) {
    tops.push(acc)
    acc += occupiedHours.has(START_HOUR + i) ? HOUR_HEIGHT : HOUR_HEIGHT_EMPTY
  }

  function topForMinute(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const idx = h - START_HOUR
    const slot = occupiedHours.has(h) ? HOUR_HEIGHT : HOUR_HEIGHT_EMPTY
    return tops[idx] + (m / 60) * slot
  }

  function heightForLesson(time: string, duration: number) {
    const s = timeToMinutes(time)
    return topForMinute(s + duration) - topForMinute(s)
  }

  return {tops, totalHeight: acc, topForMinute, heightForLesson}
}

function buildColumnFlexes(weekDays: Date[], weekLessons: Lesson[]): number[] {
  return weekDays.map((day) => (weekLessons.some((l) => isSameDay(l.date, day)) ? COL_FLEX_BUSY : COL_FLEX_EMPTY))
}

function findNextLessonId(lessons: Lesson[], ref: Date): string | null {
  const refMin = ref.getHours() * 60 + ref.getMinutes()
  let best: Lesson | null = null
  let bestDelta = Infinity
  for (const l of lessons) {
    const dayDiff =
      (Date.UTC(l.date.getFullYear(), l.date.getMonth(), l.date.getDate()) -
        Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate())) /
      86400000
    if (dayDiff < 0) continue
    const delta = dayDiff * 1440 + timeToMinutes(l.time) - refMin
    if (delta >= 0 && delta < bestDelta) {
      bestDelta = delta
      best = l
    }
  }
  return best?.id ?? null
}

export function WeekCalendar({extraClass}: {extraClass?: string}) {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today))
  const gridRef = useRef<HTMLDivElement>(null)

  const weekDays = useMemo(() => Array.from({length: 7}, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = addDays(weekStart, 6)

  const navLabel = useMemo(() => {
    const sDay = weekStart.getDate()
    const eDay = weekEnd.getDate()
    const sMonth = MONTH_NAMES_SHORT[weekStart.getMonth()]
    const eMonth = MONTH_NAMES_SHORT[weekEnd.getMonth()]
    const year = weekStart.getFullYear()
    const yearSuffix = year !== today.getFullYear() ? ` ${year}` : ''

    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${sDay}–${eDay} ${sMonth}${yearSuffix}`
    }
    return `${sDay} ${sMonth} – ${eDay} ${eMonth}${yearSuffix}`
  }, [weekStart, weekEnd])

  const weekLessons = useMemo(() => mockLessons.filter((l) => weekDays.some((d) => isSameDay(d, l.date))), [weekDays])

  const {tops, totalHeight, topForMinute, heightForLesson} = useMemo(
    () => buildHourMap(weekLessons, weekDays),
    [weekLessons, weekDays]
  )

  const colFlexes = useMemo(() => buildColumnFlexes(weekDays, weekLessons), [weekDays, weekLessons])

  const nextId = useMemo(() => findNextLessonId(mockLessons, today), [])
  const hours = Array.from({length: TOTAL_HOURS + 1}, (_, i) => START_HOUR + i)

  return (
    <div className={`${styles.card} ${extraClass ?? ''}`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h3 className={styles.title}>Расписание</h3>
        <div className={styles.nav}>
          <button className={styles.nav_btn} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label='Назад'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
              <path
                d='M15 18l-6-6 6-6'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
          <button className={styles.nav_btn_today} onClick={() => setWeekStart(getWeekStart(today))}>
            {navLabel}
          </button>
          <button className={styles.nav_btn} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label='Вперёд'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
              <path
                d='M9 18l6-6-6-6'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Day headers ── */}
      <div className={styles.day_header_row}>
        <div className={styles.time_gutter} />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const hasBusy = weekLessons.some((l) => isSameDay(l.date, day))
          return (
            <div
              key={i}
              className={[
                styles.day_header,
                isToday ? styles.day_header_today : '',
                !hasBusy ? styles.day_header_empty : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={{flex: colFlexes[i]}}
            >
              <span className={styles.day_header__name}>{WEEK_DAYS_SHORT[i]}</span>
              <span className={styles.day_header__num}>{day.getDate()}</span>
            </div>
          )
        })}
        <div className={styles.scrollbar_spacer} aria-hidden />
      </div>

      {/* ── Grid ── */}
      <div className={styles.grid_scroll} ref={gridRef}>
        <div className={styles.grid} style={{height: totalHeight}}>
          {hours.map((h, i) => (
            <div key={h} className={styles.hour_row} style={{top: tops[i]}}>
              <div className={styles.hour_label}>{h}:00</div>
              <div className={styles.hour_line} />
            </div>
          ))}

          <div className={styles.columns}>
            {weekDays.map((day, di) => {
              const dayLessons = weekLessons.filter((l) => isSameDay(l.date, day))
              return (
                <div
                  key={di}
                  className={[
                    styles.column,
                    isSameDay(day, today) ? styles.column_today : '',
                    dayLessons.length === 0 ? styles.column_empty : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{flex: colFlexes[di]}}
                >
                  {dayLessons.map((lesson) => {
                    const top = topForMinute(timeToMinutes(lesson.time))
                    const height = Math.max(heightForLesson(lesson.time, lesson.duration), 28)
                    const isShort = height < 52
                    const isNext = lesson.id === nextId

                    return (
                      <div
                        key={lesson.id}
                        className={[
                          styles.lesson_block,
                          isShort ? styles.lesson_block_short : '',
                          isNext ? styles.lesson_block_next : ''
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{top, height}}
                      >
                        <span className={styles.lesson_block__arrow} aria-hidden>
                          ↗
                        </span>
                        {!isNext && <div className={styles.lesson_block__accent} />}

                        <div className={styles.lesson_block__body}>
                          {!isShort && (
                            <Image
                              width={24}
                              height={24}
                              src={lesson.studentAvatar}
                              alt={lesson.studentName}
                              className={styles.lesson_block__avatar}
                            />
                          )}
                          <div className={styles.lesson_block__info}>
                            <span className={styles.lesson_block__name}>{lesson.studentName}</span>
                            {!isShort && <span className={styles.lesson_block__subject}>{lesson.subject}</span>}
                            <span className={styles.lesson_block__time}>
                              {lesson.time}–{formatEndTime(lesson.time, lesson.duration)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Now line */}
          {weekDays.some((d) => isSameDay(d, today)) &&
            (() => {
              const now = new Date()
              const nowMin = now.getHours() * 60 + now.getMinutes()
              if (nowMin < START_HOUR * 60 || nowMin > END_HOUR * 60) return null
              return (
                <div className={styles.now_line} style={{top: topForMinute(nowMin)}}>
                  <div className={styles.now_dot} />
                  <div className={styles.now_track} />
                </div>
              )
            })()}
        </div>
      </div>
    </div>
  )
}
