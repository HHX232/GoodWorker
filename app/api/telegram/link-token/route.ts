import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { randomBytes } from 'crypto'

// GET — check if Telegram is connected
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }

  let chatId: bigint | null = null
  if (role === 'STUDENT') {
    const u = await (prisma.student as any).findUnique({ where: { id }, select: { telegramChatId: true } })
    chatId = u?.telegramChatId ?? null
  } else if (role === 'TEACHER') {
    const u = await (prisma.teacher as any).findUnique({ where: { id }, select: { telegramChatId: true } })
    chatId = u?.telegramChatId ?? null
  }

  return NextResponse.json({ connected: chatId !== null })
}

// POST — generate a one-time deep-link token
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }
  if (!['STUDENT', 'TEACHER'].includes(role)) {
    return NextResponse.json({ error: 'Not supported for this role' }, { status: 400 })
  }

  const token = randomBytes(20).toString('hex')

  if (role === 'STUDENT') {
    await (prisma.student as any).update({ where: { id }, data: { telegramLinkToken: token } })
  } else {
    await (prisma.teacher as any).update({ where: { id }, data: { telegramLinkToken: token } })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${token}` : null

  return NextResponse.json({ token, deepLink })
}

// DELETE — unlink Telegram
export async function DELETE() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, role } = session.user as { id: string; role: string }

  if (role === 'STUDENT') {
    await (prisma.student as any).update({ where: { id }, data: { telegramChatId: null, telegramLinkToken: null } })
  } else if (role === 'TEACHER') {
    await (prisma.teacher as any).update({ where: { id }, data: { telegramChatId: null, telegramLinkToken: null } })
  }

  return NextResponse.json({ ok: true })
}
