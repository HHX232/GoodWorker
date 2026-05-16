import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

interface BlockResult {
  blockId: string
  blockType: string
  isCorrect: boolean
  score: number
  maxScore: number
}

interface NodeAnswers {
  percent: number | null
  score: number | null
  maxScore: number | null
  blocks?: BlockResult[]
}

function blockTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CHOOSE_OPTION: 'Выбор варианта',
    FREE_ANSWER: 'Свободный ответ',
    SEQUENCE: 'Последовательность',
    MATCH_PAIRS: 'Соответствие',
    FILL_TEXT: 'Вставка слов',
    HIGHLIGHT_TEXT: 'Выделение текста',
    WORD_SCRAMBLE: 'Составление слова',
    DIALOGUE: 'Диалог',
  }
  return map[type] ?? type
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

    const { nodeId, answers } = await req.json() as { nodeId: string; answers: NodeAnswers }
    if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

    const studentId = session.user.id

    const answersJson = answers as unknown as Parameters<typeof prisma.roadmapNodeFeedback.create>[0]['data']['answers']

    const feedback = await prisma.roadmapNodeFeedback.upsert({
      where: { roadmapId_nodeId_studentId: { roadmapId, nodeId, studentId } },
      create: { roadmapId, nodeId, studentId, answers: answersJson },
      update: { answers: answersJson },
    })

    // Save StudentErrors for wrong blocks (only on first submission)
    const isNew = feedback.createdAt.getTime() === feedback.updatedAt.getTime()
    const wrongBlocks = (answers?.blocks ?? []).filter((b) => !b.isCorrect)

    if (isNew && wrongBlocks.length > 0) {
      // Fetch roadmap node content to extract question text
      const roadmap = await prisma.roadmap.findUnique({
        where: { id: roadmapId },
        select: { content: true },
      })

      const content = roadmap?.content as {
        nodes?: Array<{ id: string; data?: { activeTests?: Array<{ id: string; type: string; payload?: Record<string, unknown> }> } }>
      } | null
      const node = content?.nodes?.find(n => n.id === nodeId)
      const nodeBlocks = node?.data?.activeTests ?? []
      const blockMap = new Map(nodeBlocks.map(b => [b.id, b]))

      const sourceId = `${roadmapId}/${nodeId}`

      await prisma.$transaction(
        wrongBlocks.map((b) => {
          const blockContent = blockMap.get(b.blockId)
          const payload = blockContent?.payload ?? {}
          const fragment = (
            (typeof payload.question === 'string' ? payload.question : null) ??
            (typeof payload.instruction === 'string' ? payload.instruction : null) ??
            (typeof payload.source === 'string' ? payload.source : null) ??
            null
          )?.slice(0, 500) ?? null
          const label = blockTypeLabel(b.blockType ?? blockContent?.type ?? '')
          const description = fragment ? `${label}: ${fragment.slice(0, 200)}` : label

          return prisma.studentError.create({
            data: {
              studentId,
              sourceType: 'roadmap_test',
              sourceId,
              description,
              fragment,
            },
          })
        })
      )
    }

    return NextResponse.json({ submitted: true, id: feedback.id })
  } catch (error) {
    console.error('[POST /api/roadmap/:id/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
