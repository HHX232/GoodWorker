import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const BOT_API = (token: string) => `https://api.telegram.org/bot${token}`

async function tgSend(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BOT_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    return res.ok
  } catch {
    return false
  }
}

// GET — stats: how many users have Telegram linked
export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [students, teachers] = await Promise.all([
    (prisma.student as any).count({ where: { telegramChatId: { not: null } } }),
    (prisma.teacher as any).count({ where: { telegramChatId: { not: null } } }),
  ])

  return NextResponse.json({ students, teachers, total: students + teachers })
}

// POST — broadcast or trigger reminders
export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })

  const body = await req.json()
  const { action } = body

  // ── Broadcast custom message ─────────────────────────────────────────────
  if (action === 'broadcast') {
    const { message } = body
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const [students, teachers] = await Promise.all([
      (prisma.student as any).findMany({
        where: { telegramChatId: { not: null } },
        select: { telegramChatId: true },
      }),
      (prisma.teacher as any).findMany({
        where: { telegramChatId: { not: null } },
        select: { telegramChatId: true },
      }),
    ])

    const chatIds: string[] = [
      ...students.map((s: any) => s.telegramChatId.toString()),
      ...teachers.map((t: any) => t.telegramChatId.toString()),
    ]

    let sent = 0, failed = 0
    for (const chatId of chatIds) {
      const ok = await tgSend(token, chatId, message)
      if (ok) sent++; else failed++
    }

    return NextResponse.json({ ok: true, sent, failed, total: chatIds.length })
  }

  // ── Trigger lesson reminders now ─────────────────────────────────────────
  if (action === 'trigger') {
    const hoursFrom = Number(body.hoursFrom ?? 0)
    const hoursTo   = Number(body.hoursTo   ?? 48)

    const from = new Date(Date.now() + hoursFrom * 3600_000)
    const to   = new Date(Date.now() + hoursTo   * 3600_000)

    type StudentRow = { name: string; langCode: string; chatId: string | null }
    type ConfRow = {
      id: string; title: string; scheduledAt: Date
      teacherName: string; teacherLang: string; teacherTgId: string | null
      students: StudentRow[] | null
    }

    const rows = await prisma.$queryRaw<ConfRow[]>`
      SELECT
        c.id,
        c.title,
        c."scheduledAt",
        t.name        AS "teacherName",
        t."langCode"  AS "teacherLang",
        t."telegramChatId"::text AS "teacherTgId",
        (
          SELECT json_agg(json_build_object(
            'name',    s.name,
            'langCode', s."langCode",
            'chatId',  s."telegramChatId"::text
          ))
          FROM "ConferenceParticipant" cp
          JOIN "Student" s ON s.id = cp."studentId"
          WHERE cp."conferenceId" = c.id
            AND cp."studentId"   IS NOT NULL
            AND s."telegramChatId" IS NOT NULL
        ) AS students
      FROM "Conference" c
      JOIN "Teacher"    t ON c."teacherId" = t.id
      WHERE c.status       = 'SCHEDULED'
        AND c."scheduledAt" >= ${from}
        AND c."scheduledAt" <  ${to}
      ORDER BY c."scheduledAt"
    `

    const LANGS = ['ru', 'en', 'hi', 'zh'] as const
    type Lang = typeof LANGS[number]
    const lang = (code: string): Lang => (LANGS.includes(code as Lang) ? (code as Lang) : 'en')

    const fmtDate = (d: Date, l: Lang) =>
      new Intl.DateTimeFormat({ ru: 'ru-RU', en: 'en-US', hi: 'hi-IN', zh: 'zh-CN' }[l], {
        day: 'numeric', month: 'long', year: 'numeric',
      }).format(d)

    const fmtTime = (d: Date, l: Lang) =>
      new Intl.DateTimeFormat({ ru: 'ru-RU', en: 'en-US', hi: 'hi-IN', zh: 'zh-CN' }[l], {
        hour: '2-digit', minute: '2-digit',
      }).format(d)

    const teacherMsg = (o: { title: string; names: string[]; date: string; time: string }, l: Lang) => ({
      ru: `📚 *Напоминание об уроке!*\n\n📝 ${o.title}\n👥 Ученики: ${o.names.join(', ') || 'не указаны'}\n📅 ${o.date} в ${o.time}\n\n_Удачного урока!_`,
      en: `📚 *Lesson Reminder!*\n\n📝 ${o.title}\n👥 Students: ${o.names.join(', ') || 'none'}\n📅 ${o.date} at ${o.time}\n\n_Good luck!_`,
      hi: `📚 *पाठ याद दिलाने वाला!*\n\n📝 ${o.title}\n👥 छात्र: ${o.names.join(', ') || 'कोई नहीं'}\n📅 ${o.date} को ${o.time} पर\n\n_शुभकामनाएं!_`,
      zh: `📚 *课程提醒！*\n\n📝 ${o.title}\n👥 学生：${o.names.join('、') || '未指定'}\n📅 ${o.date} ${o.time}\n\n_祝课程顺利！_`,
    }[l])

    const studentMsg = (o: { title: string; teacher: string; date: string; time: string }, l: Lang) => ({
      ru: `📚 *Напоминание об уроке!*\n\n📝 ${o.title}\n👤 Репетитор: ${o.teacher}\n📅 ${o.date} в ${o.time}\n\n_Удачного урока!_`,
      en: `📚 *Lesson Reminder!*\n\n📝 ${o.title}\n👤 Teacher: ${o.teacher}\n📅 ${o.date} at ${o.time}\n\n_Good luck!_`,
      hi: `📚 *पाठ याद दिलाने वाला!*\n\n📝 ${o.title}\n👤 शिक्षक: ${o.teacher}\n📅 ${o.date} को ${o.time} पर\n\n_शुभकामनाएं!_`,
      zh: `📚 *课程提醒！*\n\n📝 ${o.title}\n👤 教师：${o.teacher}\n📅 ${o.date} ${o.time}\n\n_祝课程顺利！_`,
    }[l])

    const sent = new Set<string>()
    let count = 0

    for (const conf of rows) {
      const d = new Date(conf.scheduledAt)

      if (conf.teacherTgId) {
        const key = `${conf.id}:${conf.teacherTgId}`
        if (!sent.has(key)) {
          sent.add(key)
          const l = lang(conf.teacherLang)
          const names = (conf.students ?? []).map(s => s.name)
          const ok = await tgSend(token, conf.teacherTgId, teacherMsg({ title: conf.title, names, date: fmtDate(d, l), time: fmtTime(d, l) }, l))
          if (ok) count++
        }
      }

      for (const s of conf.students ?? []) {
        if (!s.chatId) continue
        const key = `${conf.id}:${s.chatId}`
        if (sent.has(key)) continue
        sent.add(key)
        const l = lang(s.langCode)
        const ok = await tgSend(token, s.chatId, studentMsg({ title: conf.title, teacher: conf.teacherName, date: fmtDate(d, l), time: fmtTime(d, l) }, l))
        if (ok) count++
      }
    }

    // ── Also send reminders for manual calendar events ──────────────────
    const teachersWithTg = await (prisma.teacher as any).findMany({
      where: { telegramChatId: { not: null } },
      select: { id: true, name: true, langCode: true, telegramChatId: true, calendar: true },
    })

    const calEventMsg = (o: { title: string; student?: string; date: string; time: string }, l: Lang) => ({
      ru: `📅 *Напоминание о событии!*\n\n📝 ${o.title}${o.student ? `\n👤 Ученик: ${o.student}` : ''}\n📅 ${o.date} в ${o.time}\n\n_Не забудьте подготовиться!_`,
      en: `📅 *Event Reminder!*\n\n📝 ${o.title}${o.student ? `\n👤 Student: ${o.student}` : ''}\n📅 ${o.date} at ${o.time}\n\n_Don't forget to prepare!_`,
      hi: `📅 *इवेंट याद दिलाने वाला!*\n\n📝 ${o.title}${o.student ? `\n👤 छात्र: ${o.student}` : ''}\n📅 ${o.date} को ${o.time} पर\n\n_तैयारी मत भूलें!_`,
      zh: `📅 *活动提醒！*\n\n📝 ${o.title}${o.student ? `\n👤 学生：${o.student}` : ''}\n📅 ${o.date} ${o.time}\n\n_别忘了准备！_`,
    }[l])

    type CalEvent = { id?: string; title?: string; date?: string; startTime?: string; studentName?: string; status?: string }

    for (const teacher of teachersWithTg) {
      const calData = teacher.calendar as { events?: CalEvent[] } | null
      const events: CalEvent[] = calData?.events ?? []
      const l = lang(teacher.langCode ?? 'en')

      for (const ev of events) {
        if (!ev.title || !ev.date || !ev.startTime) continue
        if (ev.status === 'cancelled' || ev.status === 'completed') continue

        // parse event datetime
        const [y, mo, d] = ev.date.split('-').map(Number)
        const [h, mi] = ev.startTime.split(':').map(Number)
        const evDate = new Date(y, mo - 1, d, h, mi)

        if (evDate >= from && evDate < to) {
          const key = `cal:${teacher.id}:${ev.date}:${ev.startTime}:${ev.title}`
          if (sent.has(key)) continue
          sent.add(key)

          const chatId = teacher.telegramChatId.toString()
          const ok = await tgSend(
            token,
            chatId,
            calEventMsg({
              title: ev.title,
              student: ev.studentName,
              date: fmtDate(evDate, l),
              time: fmtTime(evDate, l),
            }, l)
          )
          if (ok) count++
        }
      }
    }

    return NextResponse.json({ ok: true, conferences: rows.length, sent: count })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
