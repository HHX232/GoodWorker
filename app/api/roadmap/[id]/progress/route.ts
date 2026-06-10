import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: roadmapId } = await params
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    return NextResponse.json({ completedSteps: [] })
  }

  const progress = await prisma.studentRoadmapProgress.findUnique({
    where: { studentId_roadmapId: { studentId: session.user.id, roadmapId } },
    select: { completedSteps: true },
  })

  return NextResponse.json({ completedSteps: progress?.completedSteps ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: roadmapId } = await params
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const existing = await prisma.studentRoadmapProgress.findUnique({
    where: { studentId_roadmapId: { studentId: session.user.id, roadmapId } },
  })

  let completedSteps: string[]

  // Bulk add: { nodeIds: string[] } — always add, never toggle
  if (Array.isArray(body.nodeIds) && body.nodeIds.length > 0) {
    const toAdd = body.nodeIds as string[]
    const current = existing?.completedSteps ?? []
    completedSteps = [...new Set([...current, ...toAdd])]

    if (existing) {
      await prisma.studentRoadmapProgress.update({
        where: { studentId_roadmapId: { studentId: session.user.id, roadmapId } },
        data: { completedSteps },
      })
    } else {
      await prisma.studentRoadmapProgress.create({
        data: { studentId: session.user.id, roadmapId, completedSteps },
      })
    }

    return NextResponse.json({ completedSteps })
  }

  // Single toggle: { nodeId: string }
  const { nodeId } = body
  if (!nodeId || typeof nodeId !== 'string') {
    return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
  }

  if (existing) {
    const alreadyDone = existing.completedSteps.includes(nodeId)
    completedSteps = alreadyDone
      ? existing.completedSteps.filter((id) => id !== nodeId)
      : [...existing.completedSteps, nodeId]

    await prisma.studentRoadmapProgress.update({
      where: { studentId_roadmapId: { studentId: session.user.id, roadmapId } },
      data: { completedSteps },
    })
  } else {
    completedSteps = [nodeId]
    await prisma.studentRoadmapProgress.create({
      data: { studentId: session.user.id, roadmapId, completedSteps },
    })
  }

  return NextResponse.json({ completedSteps })
}
