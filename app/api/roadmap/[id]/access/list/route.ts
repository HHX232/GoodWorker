import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/roadmap/[id]/access/list — список студентов с доступом (только для владельца)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true },
    })

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const accessList = await prisma.roadmapAccess.findMany({
      where: { roadmapId },
      include: { student: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(accessList)
  } catch (error) {
    console.error('[GET /api/roadmap/:id/access/list]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
