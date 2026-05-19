import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
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

const testSelect = {
  id: true,
  title: true,
  aiTopic: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  teacherId: true,
  teacher: {
    select: {id: true, name: true, avatarUrl: true}
  },
  testCategories: {
    include: {
      category: {
        include: {translations: true}
      }
    }
  }
} as const

export async function GET(req: NextRequest) {
  const {searchParams} = req.nextUrl
  const teacherIdParam = searchParams.get('teacherId')
  const allParam = searchParams.get('all')

  // Public: fetch published tests by a specific teacher — no auth required
  if (teacherIdParam) {
    const tests = await prisma.test.findMany({
      where: {teacherId: teacherIdParam},
      select: testSelect,
      orderBy: {createdAt: 'desc'}
    })
    return NextResponse.json(tests)
  }

  // Admin: fetch all tests
  if (allParam === 'true') {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }
    const tests = await prisma.test.findMany({
      select: testSelect,
      orderBy: {createdAt: 'desc'}
    })
    return NextResponse.json(tests)
  }

  // Default: own tests (teacher auth required)
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
    select: testSelect,
    orderBy: {createdAt: 'desc'}
  })

  return NextResponse.json(tests)
}
