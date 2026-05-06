import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/roadmap/[id]/feedback?nodeId=xxx
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const nodeId = req.nextUrl.searchParams.get('nodeId')
    if (!nodeId) return NextResponse.json({ submitted: false })

    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ submitted: false })
    }

    const feedback = await prisma.roadmapNodeFeedback.findUnique({
      where: { roadmapId_nodeId_studentId: { roadmapId, nodeId, studentId: session.user.id } },
      select: { answers: true },
    })

    return NextResponse.json({ submitted: !!feedback, answers: feedback?.answers ?? null })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/roadmap/[id]/feedback
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { nodeId, answers } = await req.json() as { nodeId: string; answers: any }
    if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

    const feedback = await prisma.roadmapNodeFeedback.upsert({
      where: { roadmapId_nodeId_studentId: { roadmapId, nodeId, studentId: session.user.id } },
      create: { roadmapId, nodeId, studentId: session.user.id, answers },
      update: { answers },
    })

    return NextResponse.json({ submitted: true, id: feedback.id })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
