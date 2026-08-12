import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const assignments = await prisma.homeworkAssignment.findMany({
      where: { studentId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        grade: true,
        homework: {
          select: { id: true, title: true, dueAt: true, sendAt: true },
        },
      },
    })

    const homeworks = assignments.map(a => ({
      id: a.id,
      title: a.homework.title,
      dueAt: a.homework.dueAt?.toISOString() ?? null,
      sendAt: a.homework.sendAt?.toISOString() ?? null,
      href: `/homework/${a.id}`,
      status: a.status,
      grade: a.grade,
    }))

    return NextResponse.json({ homeworks })
  } catch (e) {
    console.error('[GET /api/homework/mine]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
