import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ ok: false })

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true },
    })
    if (!roadmap) return NextResponse.json({ ok: false })

    // Не считаем просмотры владельца
    if (session.user.role === 'TEACHER' && roadmap.teacherId === session.user.id) {
      return NextResponse.json({ ok: false })
    }

    if (session.user.role === 'STUDENT') {
      const exists = await prisma.roadmapView.findUnique({
        where: { roadmapId_studentId: { roadmapId, studentId: session.user.id } },
        select: { id: true },
      })
      if (!exists) {
        await prisma.roadmapView.create({
          data: { roadmapId, studentId: session.user.id, viewerRole: 'STUDENT' },
        })
      }
    } else {
      const exists = await prisma.roadmapView.findFirst({
        where: { roadmapId, teacherId: session.user.id },
        select: { id: true },
      })
      if (!exists) {
        await prisma.roadmapView.create({
          data: { roadmapId, teacherId: session.user.id, viewerRole: 'TEACHER' },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/view]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
