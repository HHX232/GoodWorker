import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { tplHomeworkAssigned } from '@/shared/lib/notificationTemplates'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, content, sendAt, dueAt, studentIds } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'At least one student is required' }, { status: 400 })
    }
    if (!content?.blocks || !Array.isArray(content.blocks) || content.blocks.length === 0) {
      return NextResponse.json({ error: 'At least one content block is required' }, { status: 400 })
    }

    const homework = await prisma.homework.create({
      data: {
        teacherId: session.user.id,
        title: title.trim(),
        content,
        sendAt: sendAt ? new Date(sendAt) : null,
        dueAt: dueAt ? new Date(dueAt) : null,
        assignments: {
          create: studentIds.map((studentId: string) => ({ studentId })),
        },
      },
      include: {
        assignments: { select: { id: true, studentId: true } },
      },
    })

    // Send Telegram notifications to students (fire-and-forget)
    try {
      const studentIds = homework.assignments.map((a: { studentId: string }) => a.studentId)
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds }, NOT: { telegramChatId: null } },
        select: { telegramChatId: true, name: true },
      })

      const { sendTelegramMessage } = await import('@/lib/telegram')
      const dueText = homework.dueAt
        ? `\nСрок: ${new Date(homework.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
        : ''

      await Promise.allSettled(
        students.map(s =>
          s.telegramChatId
            ? sendTelegramMessage(
                BigInt(s.telegramChatId as bigint),
                `📚 Новое домашнее задание!\n\n*${homework.title}*${dueText}\n\nОткройте приложение для просмотра.`
              )
            : Promise.resolve()
        )
      )
    } catch {}

    // Site notifications
    const tpl = tplHomeworkAssigned(homework.title, homework.dueAt?.toISOString() ?? null)
    await Promise.allSettled(
      homework.assignments.map((a: { studentId: string; id: string }) =>
        createNotification({
          type: NOTIFICATION_TYPES.HOMEWORK_ASSIGNED,
          ...tpl,
          studentId: a.studentId,
          payload: {
            homeworkId: homework.id,
            assignmentId: a.id,
          },
        })
      )
    )

    return NextResponse.json({ homework })
  } catch (e) {
    console.error('[POST /api/homework]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const homeworks = await prisma.homework.findMany({
      where: { teacherId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            student: { select: { id: true, name: true } },
            blockProgress: { select: { blockIndex: true } },
          },
        },
      },
    })

    return NextResponse.json({ homeworks })
  } catch (e) {
    console.error('[GET /api/homework]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
