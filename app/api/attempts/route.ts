import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../auth'

// Extract a human-readable question text from any block payload
function extractBlockText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const text =
    (typeof p.question === 'string' ? p.question : null) ??
    (typeof p.instruction === 'string' ? p.instruction : null) ??
    (typeof p.source === 'string' ? p.source : null) ??
    (typeof p.hint === 'string' ? p.hint : null)
  return text ? text.slice(0, 500) : null
}

// Short label by block type
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

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const student = await prisma.student.findUnique({
    where: {email: session.user.email}
  })
  if (!student) return NextResponse.json({error: 'Student not found'}, {status: 404})

  const {testId, result, answers} = await req.json()

  // Fetch test content + categories together
  const test = await prisma.test.findUnique({
    where: {id: testId},
    select: {
      content: true,
      testCategories: {select: {categoryId: true}},
    }
  })

  const categoryIds = (test?.testCategories ?? []).map((tc) => tc.categoryId)

  // Build block content map for descriptions / fragments
  const testBlocks = (
    (test?.content as {blocks?: Array<{id: string; type: string; payload?: unknown}>} | null)?.blocks ?? []
  )
  const blockMap = new Map(testBlocks.map(b => [b.id, b]))

  // Save attempt
  const attempt = await prisma.studentTestAttempt.create({
    data: {
      studentId: student.id,
      testId,
      score: result.totalScore,
      maxScore: result.maxScore,
      percent: result.percent,
      answers,
      blockResults: result.blocks,
      finishedAt: new Date()
    }
  })

  // Save errors for wrong blocks with meaningful descriptions
  const wrongBlocks = (
    result.blocks as Array<{
      blockId: string
      blockType: string
      isCorrect: boolean
      score: number
      maxScore: number
    }>
  ).filter((b) => !b.isCorrect)

  if (wrongBlocks.length > 0) {
    await prisma.$transaction(
      wrongBlocks.map((b) => {
        const blockContent = blockMap.get(b.blockId)
        const fragment = extractBlockText(blockContent?.payload)
        const label = blockTypeLabel(b.blockType ?? blockContent?.type ?? '')
        const description = fragment
          ? `${label}: ${fragment.slice(0, 200)}`
          : label

        return prisma.studentError.create({
          data: {
            studentId: student.id,
            sourceType: 'test',
            sourceId: testId,
            attemptId: attempt.id,
            description,
            fragment,
            categories: categoryIds.length
              ? {create: categoryIds.map((categoryId) => ({categoryId}))}
              : undefined,
          },
        })
      })
    )
  }

  return NextResponse.json({attemptId: attempt.id, errorsCreated: wrongBlocks.length})
}
