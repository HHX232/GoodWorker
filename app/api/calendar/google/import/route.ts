import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'

interface GoogleCalEvent {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  status?: string
}

interface ClassifiedEvent {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  color: string
  noteType: 'event' | 'note'
  studentName?: string
  warning: boolean
  description?: string
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, teacherId, students } = await req.json() as {
      accessToken: string
      teacherId: string
      students: string[]
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken required' }, { status: 400 })
    }

    // Fetch Google Calendar events (last 30 days + next 30 days)
    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setDate(timeMin.getDate() - 30)
    const timeMax = new Date(now)
    timeMax.setDate(timeMax.getDate() + 30)

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: '100',
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!gcalRes.ok) {
      const err = await gcalRes.text()
      return NextResponse.json({ error: `Google Calendar API: ${err}` }, { status: 502 })
    }

    const gcalData = await gcalRes.json()
    const rawEvents: GoogleCalEvent[] = gcalData.items ?? []

    if (rawEvents.length === 0) {
      return NextResponse.json({
        events: [],
        summary: 'В вашем Google Calendar не найдено событий за последние 30 дней.',
        teacherId,
      })
    }

    // Format for AI
    const eventsText = rawEvents
      .slice(0, 60)
      .map((e, i) => {
        const start = e.start?.dateTime ?? e.start?.date ?? ''
        const end = e.end?.dateTime ?? e.end?.date ?? ''
        return `${i + 1}. "${e.summary ?? 'Без названия'}" | ${start} → ${end} | ${e.description ?? ''}`
      })
      .join('\n')

    const studentsText = (students ?? []).join(', ') || 'нет данных'

    const prompt = `Ты — помощник учителя. Вот список событий из Google Calendar:

${eventsText}

Список учеников учителя: ${studentsText}

Для каждого события определи:
1. type: "event" (встреча/урок с учеником) или "note" (личная заметка, напоминание, задача)
2. studentName: имя ученика из списка, если событие явно связано с ним (или null)
3. color: одно из ["purple", "teal", "pink", "amber", "blue", "coral"] — подбери тематически

Ответь ТОЛЬКО валидным JSON-массивом (без markdown, без пояснений):
[
  {"index": 1, "type": "event", "studentName": "Иван Петров", "color": "purple"},
  ...
]

В конце добавь ОТДЕЛЬНЫЙ JSON-объект (после массива) с полем "summary" — краткий список (3-5 пунктов) того, что учителю нужно перепроверить или подтвердить.
Формат:
{"summary": "..."}
`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const aiText = result.response.text().trim()

    // Parse AI response — extract array + summary object
    let classifications: { index: number; type: string; studentName?: string; color: string }[] = []
    let summary = ''

    // Find the JSON array
    const arrMatch = aiText.match(/\[[\s\S]*?\]/)
    if (arrMatch) {
      try { classifications = JSON.parse(arrMatch[0]) } catch { /* ignore */ }
    }

    // Find the summary object — last {...} with a "summary" key
    const sumMatch = [...aiText.matchAll(/\{[^{}]*"summary"\s*:/g)]
    if (sumMatch.length > 0) {
      const lastIdx = aiText.lastIndexOf(sumMatch[sumMatch.length - 1][0])
      const objStr = aiText.slice(lastIdx).match(/\{[\s\S]*?\}/)
      if (objStr) {
        try { summary = JSON.parse(objStr[0]).summary ?? '' } catch { /* ignore */ }
      }
    }

    // Build final CalendarEvent list
    const classMap = new Map(classifications.map(c => [c.index, c]))

    const events: ClassifiedEvent[] = rawEvents.slice(0, 60).map((e, i) => {
      const cls = classMap.get(i + 1)
      const startRaw = e.start?.dateTime ?? e.start?.date ?? ''
      const endRaw = e.end?.dateTime ?? e.end?.date ?? ''

      // Parse date/time
      let date = ''
      let startTime = '09:00'
      let endTime = '10:00'

      if (startRaw) {
        const d = new Date(startRaw)
        date = d.toISOString().split('T')[0]
        if (startRaw.includes('T')) {
          startTime = d.toTimeString().slice(0, 5)
        }
      }
      if (endRaw && endRaw.includes('T')) {
        const d = new Date(endRaw)
        endTime = d.toTimeString().slice(0, 5)
      }

      return {
        id: randomUUID(),
        title: e.summary ?? 'Событие из Google',
        date,
        startTime,
        endTime,
        color: (cls?.color ?? 'blue') as ClassifiedEvent['color'],
        noteType: (cls?.type === 'note' ? 'note' : 'event') as 'event' | 'note',
        studentName: cls?.studentName ?? undefined,
        description: e.description ?? undefined,
        warning: true,
      }
    })

    return NextResponse.json({ events, summary, teacherId })
  } catch (err: unknown) {
    console.error('[google/import]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
