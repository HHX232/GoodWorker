import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    const conferences = await prisma.conference.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: now },
        participants: { some: { studentId: session.user.id } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        roomName: true,
        teacher: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({ conferences })
  } catch (error) {
    console.error('[GET /api/student/upcoming-meetings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
