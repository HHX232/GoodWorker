import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { CalendarEvent, CalendarTask } from '@/shared/types/Calendar/calendar.types'

interface Props {
  events: CalendarEvent[]
  tasks: CalendarTask[]
  monthLabel: string
}

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

function fmtNow(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

function eventWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'событие'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'события'
  return 'событий'
}

function groupEventsByDate(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const sorted = [...events].sort((a, b) => {
    const da = new Date(`${a.date}T${a.startTime ?? '00:00'}`)
    const db = new Date(`${b.date}T${b.startTime ?? '00:00'}`)
    return da.getTime() - db.getTime()
  })
  const map: Record<string, CalendarEvent[]> = {}
  for (const e of sorted) {
    if (!map[e.date]) map[e.date] = []
    map[e.date].push(e)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

const EVENT_COLORS: Record<string, string> = {
  purple: '#7c3aed',
  teal: '#0d9488',
  pink: '#db2777',
  amber: '#d97706',
  blue: '#2563eb',
  coral: '#ea580c',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Выполнено',
  cancelled: 'Отменено',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#16a34a',
  medium: '#d97706',
  high: '#dc2626',
}

const PRIORITY_BG: Record<string, string> = {
  low: '#dcfce7',
  medium: '#fef3c7',
  high: '#fee2e2',
}

const PAD = 28

const s = StyleSheet.create({
  page: { backgroundColor: '#f8fafc', fontFamily: 'Roboto', paddingBottom: 44 },

  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    paddingHorizontal: PAD,
    paddingTop: 22,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  headerSub: { fontSize: 10, color: '#94a3b8' },
  headerBrand: { fontSize: 11, fontWeight: 700, color: '#534AB7', marginTop: 4 },

  body: { paddingHorizontal: PAD, paddingTop: 14 },

  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 10,
  },

  dateLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 5,
    marginTop: 8,
  },

  eventRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    marginBottom: 5,
    overflow: 'hidden',
  },
  eventBar: { width: 4 },
  eventContent: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  eventTime: { fontSize: 9, color: '#94a3b8', marginBottom: 2 },
  eventTitle: { fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 },
  eventMeta: { fontSize: 9, color: '#64748b' },
  eventStatus: { fontSize: 8, color: '#94a3b8', marginTop: 3 },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    marginBottom: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  taskDot: {
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 1.5,
    borderStyle: 'solid',
    marginTop: 1,
    marginRight: 8,
    flexShrink: 0,
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 11, fontWeight: 500, color: '#0f172a', marginBottom: 3 },
  taskTitleDone: { color: '#94a3b8' },
  taskMeta: { flexDirection: 'row', gap: 6 },
  taskDue: { fontSize: 9, color: '#64748b' },
  taskPriority: { fontSize: 8, fontWeight: 700, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },

  empty: { fontSize: 11, color: '#94a3b8', paddingVertical: 10 },

  footer: { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center' },
  footerText: { fontSize: 8, color: '#cbd5e1' },
})

export function CalendarPDFDoc({ events, tasks, monthLabel }: Props) {
  const groups = groupEventsByDate(events)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerBar}>
          <View>
            <Text style={s.headerTitle}>Расписание</Text>
            <Text style={s.headerSub}>{monthLabel} · {events.length} {eventWord(events.length)}</Text>
          </View>
          <Text style={s.headerBrand}>GoodWorker</Text>
        </View>

        <View style={s.body}>

          <Text style={s.sectionTitle}>СОБЫТИЯ</Text>

          {groups.length === 0 && <Text style={s.empty}>Нет событий</Text>}

          {groups.map(([date, evs]) => (
            <View key={date}>
              <Text style={s.dateLabel}>{fmtDate(date)}</Text>
              {evs.map((ev, i) => {
                const color = EVENT_COLORS[ev.color] ?? '#7c3aed'
                const meta = [ev.studentName, ev.subject].filter(Boolean).join(' · ')
                return (
                  <View key={i} style={s.eventRow}>
                    <View style={[s.eventBar, { backgroundColor: color }]} />
                    <View style={s.eventContent}>
                      <Text style={s.eventTime}>{ev.startTime} — {ev.endTime}</Text>
                      <Text style={s.eventTitle}>{ev.title}</Text>
                      {meta ? <Text style={s.eventMeta}>{meta}</Text> : null}
                      {ev.status && ev.status !== 'scheduled'
                        ? <Text style={s.eventStatus}>{STATUS_LABELS[ev.status] ?? ev.status}</Text>
                        : null}
                    </View>
                  </View>
                )
              })}
            </View>
          ))}

          <Text style={s.sectionTitle}>ЗАДАЧИ</Text>

          {tasks.length === 0 && <Text style={s.empty}>Нет задач</Text>}

          {tasks.map((task, i) => (
            <View key={i} style={s.taskRow}>
              <View style={[
                s.taskDot,
                task.completed
                  ? { backgroundColor: '#534AB7', borderColor: '#534AB7' }
                  : { borderColor: '#cbd5e1' },
              ]} />
              <View style={s.taskContent}>
                <Text style={task.completed ? { ...s.taskTitle, ...s.taskTitleDone } : s.taskTitle}>
                  {task.title}
                </Text>
                <View style={s.taskMeta}>
                  {task.dueDate
                    ? <Text style={s.taskDue}>до {task.dueDate}</Text>
                    : null}
                  {task.priority
                    ? <Text style={[s.taskPriority, {
                        color: PRIORITY_COLOR[task.priority] ?? '#94a3b8',
                        backgroundColor: PRIORITY_BG[task.priority] ?? '#f1f5f9',
                      }]}>
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </Text>
                    : null}
                </View>
              </View>
            </View>
          ))}

        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>GoodWorker — Экспортировано {fmtNow()}</Text>
        </View>

      </Page>
    </Document>
  )
}
