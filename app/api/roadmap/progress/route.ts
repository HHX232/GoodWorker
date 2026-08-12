import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const roadmapId = searchParams.get('roadmapId')
    if (!roadmapId) return NextResponse.json({ error: 'roadmapId required' }, { status: 400 })

    // Get the roadmap to count total nodes
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { content: true },
    })

    if (!roadmap) return NextResponse.json({ completed: 0, total: 0 })

    // Count total nodes (exclude ENTRY_POINT and DIVIDER)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = roadmap.content as any
    const nodes: any[] = content?.nodes ?? []
    const total = nodes.filter(
      (n: any) => !['ENTRY_POINT', 'DIVIDER'].includes(n.data?.type)
    ).length

    // Count student's completed steps from StudentRoadmapProgress
    const progress = await prisma.studentRoadmapProgress.findUnique({
      where: { studentId_roadmapId: { studentId: session.user.id, roadmapId } },
      select: { completedSteps: true },
    })

    const completed = progress?.completedSteps?.length ?? 0

    return NextResponse.json({ completed, total })
  } catch (e) {
    console.error('[GET /api/roadmap/progress]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
