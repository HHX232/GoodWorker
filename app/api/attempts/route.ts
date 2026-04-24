import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../auth'

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
  // result: TestResult { totalScore, maxScore, percent, blocks: BlockResult[] }
  // answers: Record<blockId, StudentAnswer>

  const testCategories = await prisma.testCategory.findMany({
    where: {testId},
    select: {categoryId: true}
  })
  const categoryIds = testCategories.map((tc) => tc.categoryId)

  // Сохраняем попытку
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

  // Сохраняем ошибки только для неправильных блоков
  const wrongBlocks = (
    result.blocks as Array<{
      blockId: string
      isCorrect: boolean
      score: number
      maxScore: number
    }>
  ).filter((b) => !b.isCorrect)

  if (wrongBlocks.length > 0 && categoryIds.length > 0) {
    await prisma.studentError.createMany({
      data: wrongBlocks.map((b) => ({
        studentId: student.id,
        sourceType: 'test',
        sourceId: attempt.id,
        attemptId: attempt.id,
        description: `Блок ${b.blockId}: ${b.score}/${b.maxScore}`
      }))
    })

    const createdErrors = await prisma.studentError.findMany({
      where: {attemptId: attempt.id},
      select: {id: true}
    })

    await prisma.studentErrorCategory.createMany({
      data: createdErrors.flatMap((err) =>
        categoryIds.map((categoryId) => ({
          errorId: err.id,
          categoryId
        }))
      )
    })
  }

  return NextResponse.json({attemptId: attempt.id, errorsCreated: wrongBlocks.length})
}
