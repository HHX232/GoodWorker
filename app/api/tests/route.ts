import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../auth'

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const teacher = await prisma.teacher.findUnique({
    where: {email: session.user.email}
  })

  if (!teacher) {
    return NextResponse.json({error: 'Not a teacher'}, {status: 403})
  }

  const {title, theme, description, blocks, categoryIds} = await req.json()

  const test = await prisma.test.create({
    data: {
      teacherId: teacher.id,
      title,
      aiTopic: theme,
      content: {description, blocks},
      testCategories: {
        create: (categoryIds as string[]).map((categoryId) => ({categoryId}))
      }
    },
    include: {testCategories: true}
  })

  return NextResponse.json(test)
}

export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const teacher = await prisma.teacher.findUnique({
    where: {email: session.user.email}
  })

  if (!teacher) {
    return NextResponse.json({error: 'Not a teacher'}, {status: 403})
  }

  const tests = await prisma.test.findMany({
    where: {teacherId: teacher.id},
    include: {
      testCategories: {
        include: {
          category: {
            include: {translations: true}
          }
        }
      }
    },
    orderBy: {createdAt: 'desc'}
  })

  return NextResponse.json(tests)
}
