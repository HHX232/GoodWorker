import { prisma } from '@/shared/prisma/prisma'
import { createNotification } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { complaintId } = await req.json()
    if (!complaintId) return NextResponse.json({ error: 'complaintId required' }, { status: 400 })

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, reporterId: true, reporterRole: true, targetType: true },
    })

    if (!complaint) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (complaint.targetType !== 'PLATFORM') {
      return NextResponse.json({ error: 'Only platform feedback can be marked as valuable' }, { status: 400 })
    }

    const isTeacher = complaint.reporterRole === 'TEACHER'

    await createNotification({
      type: 'SYSTEM',
      title: 'Ваш отзыв отмечен как ценный',
      body: 'Администраторы рассмотрели ваш отзыв и нашли информацию полезной. Если она окажется стоящей — вы получите вознаграждение.',
      payload: {
        html: '<p>Администраторы рассмотрели ваш отзыв и нашли информацию полезной. Если она окажется стоящей, вы получите вознаграждение в уведомлениях. Спасибо за участие в развитии платформы!</p>',
      },
      ...(isTeacher ? { teacherId: complaint.reporterId } : { studentId: complaint.reporterId }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/admin/feedback-valuable]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
