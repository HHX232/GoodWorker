import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

async function requireTeacherLink(teacherId: string, studentId: string) {
  const link = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
  })
  return !!link
}

// GET /api/teacher/payment-reminder?studentId=xxx — read the "remind every N lessons" setting
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role: string }).role
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const studentId = req.nextUrl.searchParams.get('studentId')
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    const teacherId = session.user.id
    if (!(await requireTeacherLink(teacherId, studentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const setting = await prisma.paymentReminderSetting.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
    })

    return NextResponse.json({ everyNLessons: setting?.everyNLessons ?? null })
  } catch (e) {
    console.error('[GET /api/teacher/payment-reminder]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PUT /api/teacher/payment-reminder — set or clear the reminder cadence for a student
// body: { studentId: string, everyNLessons: number | null }  (null/0 disables the reminder)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as { role: string }).role
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { studentId, everyNLessons } = await req.json()
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    const teacherId = session.user.id
    if (!(await requireTeacherLink(teacherId, studentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!everyNLessons || everyNLessons <= 0) {
      await prisma.paymentReminderSetting.deleteMany({ where: { teacherId, studentId } })
      return NextResponse.json({ everyNLessons: null })
    }

    const n = Math.min(Math.floor(everyNLessons), 999)
    await prisma.paymentReminderSetting.upsert({
      where: { teacherId_studentId: { teacherId, studentId } },
      create: { teacherId, studentId, everyNLessons: n },
      update: { everyNLessons: n },
    })

    return NextResponse.json({ everyNLessons: n })
  } catch (e) {
    console.error('[PUT /api/teacher/payment-reminder]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
