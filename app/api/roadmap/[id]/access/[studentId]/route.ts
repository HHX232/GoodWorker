import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

interface Params {
  params: Promise<{ id: string; studentId: string }>
}

// DELETE /api/roadmap/[id]/access/[studentId] — учитель отзывает доступ
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId, studentId } = await params
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
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

    await prisma.roadmapAccess.delete({
      where: { roadmapId_studentId: { roadmapId, studentId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/roadmap/:id/access/:studentId]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
