import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { tplVideoCallInvite } from '@/shared/lib/notificationTemplates'
import { sendTelegramMessage } from '@/lib/telegram'

const APP_URL = 'https://goodworker.up.railway.app'

// POST /api/call/rooms/invite
// Body: { roomId, targetEmail? }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { roomId, targetEmail } = body

    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })
    if (!targetEmail) return NextResponse.json({ error: 'targetEmail required' }, { status: 400 })

    // Verify caller is room owner
    const room = await prisma.videoCallRoom.findUnique({ where: { id: roomId } })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    if (room.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not room owner' }, { status: 403 })
    }

    const senderName = session.user.name ?? 'Пользователь'
    const roomLink = `${APP_URL}/call/${roomId}`
    const roomName = room.topic ?? room.name
    const notifTpl = tplVideoCallInvite(senderName, roomName)

    // Find target: try teacher first, then student
    const teacher = await prisma.teacher.findUnique({
      where: { email: targetEmail },
      select: { id: true, telegramChatId: true },
    })

    if (teacher) {
      await createNotification({
        type: NOTIFICATION_TYPES.VIDEO_CALL_INVITE,
        ...notifTpl,
        payload: { roomId, roomLink, senderName },
        teacherId: teacher.id,
      })
      if (teacher.telegramChatId && session.user.role === 'TEACHER') {
        const tgText = `📹 *${senderName}* приглашает вас в видеозвонок\n\n🏠 Комната: *${room.topic ?? room.name}*\n\n🔗 [Перейти в комнату](${roomLink})`
        await sendTelegramMessage(teacher.telegramChatId, tgText)
      }
      return NextResponse.json({ ok: true })
    }

    const student = await prisma.student.findUnique({
      where: { email: targetEmail },
      select: { id: true, telegramChatId: true },
    })

    if (student) {
      await createNotification({
        type: NOTIFICATION_TYPES.VIDEO_CALL_INVITE,
        ...notifTpl,
        payload: { roomId, roomLink, senderName },
        studentId: student.id,
      })
      if (student.telegramChatId && session.user.role === 'TEACHER') {
        const tgText = `📹 *${senderName}* приглашает вас в видеозвонок\n\n🏠 Комната: *${room.topic ?? room.name}*\n\n🔗 [Перейти в комнату](${roomLink})`
        await sendTelegramMessage(student.telegramChatId, tgText)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
