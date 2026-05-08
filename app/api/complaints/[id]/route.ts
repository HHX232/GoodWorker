import { prisma } from '@/shared/prisma/prisma'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { reply?: string; status?: string }
    const role = session.user.role

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { roadmapId: true, postId: true, status: true, reporterId: true, reporterRole: true },
    })
    if (!complaint) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Teacher: can reply if they own the roadmap or post
    if (role === 'TEACHER') {
      let authorized = false

      if (complaint.roadmapId) {
        const roadmap = await prisma.roadmap.findUnique({
          where: { id: complaint.roadmapId },
          select: { teacherId: true },
        })
        authorized = roadmap?.teacherId === session.user.id
      } else if (complaint.postId) {
        const post = await prisma.post.findUnique({
          where: { id: complaint.postId },
          select: { teacherId: true },
        })
        authorized = post?.teacherId === session.user.id
      }

      if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (!body.reply?.trim()) return NextResponse.json({ error: 'Reply required' }, { status: 400 })

      const updated = await prisma.complaint.update({
        where: { id },
        data: { reply: body.reply.trim(), repliedAt: new Date(), status: 'answered' },
      })

      // Notify the reporter
      if (complaint.reporterRole === 'STUDENT') {
        await createNotification({
          type: NOTIFICATION_TYPES.COMPLAINT_REPLIED,
          title: 'Ответ на вашу жалобу',
          body: `Автор контента ответил на вашу жалобу`,
          payload: { complaintId: id },
          studentId: complaint.reporterId,
        })
      }

      return NextResponse.json(updated)
    }

    // Admin: can set any status or reply
    if (role === 'ADMIN') {
      const data: Record<string, unknown> = {}
      if (body.reply?.trim()) {
        data.reply = body.reply.trim()
        data.repliedAt = new Date()
      }
      if (body.status) data.status = body.status

      const updated = await prisma.complaint.update({ where: { id }, data })

      // Notify reporter if closed
      if (body.status === 'closed' || body.status === 'resolved') {
        if (complaint.reporterRole === 'STUDENT') {
          await createNotification({
            type: NOTIFICATION_TYPES.COMPLAINT_CLOSED,
            title: 'Жалоба закрыта',
            body: `Ваша жалоба была закрыта администратором`,
            payload: { complaintId: id },
            studentId: complaint.reporterId,
          })
        }
      }

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (error) {
    console.error('[PATCH /api/complaints/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
