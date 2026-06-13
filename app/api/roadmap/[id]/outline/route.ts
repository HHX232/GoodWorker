import { prisma } from '@/shared/prisma/prisma'
import { generateAutoOutline } from '@/shared/lib/roadmapOutline'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: roadmapId } = await params

  try {
    const outline = await prisma.roadmapOutline.findUnique({
      where: { roadmapId },
    })

    // AI steps take priority; fall back to cached auto steps
    if (outline?.aiSteps) {
      return NextResponse.json({ steps: outline.aiSteps, source: 'ai' })
    }
    if (outline?.autoSteps) {
      return NextResponse.json({ steps: outline.autoSteps, source: 'auto' })
    }

    // Generate and cache auto steps
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { content: true },
    })
    if (!roadmap) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = roadmap.content as any
    const steps = generateAutoOutline({
      nodes: content?.nodes ?? [],
      edges: content?.edges ?? [],
    })

    await prisma.roadmapOutline.upsert({
      where: { roadmapId },
      create: { roadmapId, autoSteps: steps },
      update: { autoSteps: steps },
    })

    return NextResponse.json({ steps, source: 'auto' })
  } catch (e) {
    console.error('[GET /api/roadmap/[id]/outline]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Teacher saves AI-generated outline
export async function POST(req: NextRequest, { params }: Params) {
  const { id: roadmapId } = await params

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true },
    })
    if (!roadmap || roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { steps } = await req.json()
    if (!Array.isArray(steps)) {
      return NextResponse.json({ error: 'steps must be an array' }, { status: 400 })
    }

    const outline = await prisma.roadmapOutline.upsert({
      where: { roadmapId },
      create: { roadmapId, aiSteps: steps },
      update: { aiSteps: steps },
    })

    return NextResponse.json({ outline })
  } catch (e) {
    console.error('[POST /api/roadmap/[id]/outline]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Teacher clears AI outline (revert to auto)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: roadmapId } = await params

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.roadmapOutline.updateMany({
      where: { roadmapId },
      data: { aiSteps: null },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/roadmap/[id]/outline]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
