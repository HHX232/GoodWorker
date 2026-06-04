import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

type Lang = 'ru' | 'en' | 'hi' | 'zh'
const LANGS = ['ru', 'en', 'hi', 'zh'] as const
function lang(code: string): Lang {
  return LANGS.includes(code as Lang) ? (code as Lang) : 'en'
}

function eventMsg(
  o: { title: string; date: string; startTime: string; endTime: string; studentName?: string },
  l: Lang
): string {
  const student = o.studentName
  return {
    ru: `📅 *Новое событие создано!*\n\n📝 ${o.title}${student ? `\n👤 Ученик: ${student}` : ''}\n🕐 ${o.date} ${o.startTime}–${o.endTime}\n\n_Успейте подготовиться заранее!_`,
    en: `📅 *New event created!*\n\n📝 ${o.title}${student ? `\n👤 Student: ${student}` : ''}\n🕐 ${o.date} ${o.startTime}–${o.endTime}\n\n_Get ready in advance!_`,
    hi: `📅 *नया इवेंट बनाया गया!*\n\n📝 ${o.title}${student ? `\n👤 छात्र: ${student}` : ''}\n🕐 ${o.date} ${o.startTime}–${o.endTime}\n\n_समय से तैयारी करें!_`,
    zh: `📅 *新活动已创建！*\n\n📝 ${o.title}${student ? `\n👤 学生：${student}` : ''}\n🕐 ${o.date} ${o.startTime}–${o.endTime}\n\n_提前做好准备！_`,
  }[l]
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: false, reason: 'no token' })

  const teacher = await (prisma.teacher as any).findUnique({
    where: { id: session.user.id },
    select: { telegramChatId: true, langCode: true },
  })

  if (!teacher?.telegramChatId) return NextResponse.json({ ok: false, reason: 'no tg' })

  const { title, date, startTime, endTime, studentName } = await req.json()

  const l = lang(teacher.langCode ?? 'en')
  const text = eventMsg({ title, date, startTime, endTime, studentName }, l)

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: teacher.telegramChatId.toString(), text, parse_mode: 'Markdown' }),
  })

  return NextResponse.json({ ok: true })
}
