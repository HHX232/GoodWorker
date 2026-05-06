import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/roadmap/[id]/purchase — студент покупает доступ (заглушка, без реальной оплаты)
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true, nodeAccessType: true, price: true },
    })

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (roadmap.nodeAccessType !== 'PURCHASE') {
      return NextResponse.json({ error: 'This roadmap does not require purchase' }, { status: 400 })
    }

    // Владелец не может покупать собственный роадмап
    if (session.user.role === 'TEACHER' && roadmap.teacherId === session.user.id) {
      return NextResponse.json({ error: 'Owner already has access' }, { status: 400 })
    }

    const access = await prisma.roadmapAccess.upsert({
      where: { roadmapId_studentId: { roadmapId, studentId: session.user.id } },
      create: { roadmapId, studentId: session.user.id, grantedBy: 'PURCHASE' },
      update: { grantedBy: 'PURCHASE' },
    })

    return NextResponse.json({ success: true, access })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/purchase]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
