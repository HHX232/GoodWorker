import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../../auth'

type Params = {params: Promise<{id: string}>}

export async function GET(_: Request, {params}: Params) {
  const {id} = await params

  const test = await prisma.test.findUnique({
    where: {id},
    include: {testCategories: {include: {category: true}}}
  })

  if (!test) {
    return NextResponse.json({error: 'Not found'}, {status: 404})
  }

  return NextResponse.json(test)
}

export async function PATCH(req: Request, {params}: Params) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const {id} = await params
  const test = await prisma.test.findUnique({where: {id}, select: {teacherId: true}})
  if (!test) return NextResponse.json({error: 'Not found'}, {status: 404})

  const teacher = await prisma.teacher.findUnique({where: {email: session.user.email}, select: {id: true}})
  if (!teacher || (teacher.id !== test.teacherId && session.user.role !== 'ADMIN')) {
    return NextResponse.json({error: 'Forbidden'}, {status: 403})
  }

  const {title, theme, description, blocks, categoryIds} = await req.json()

  const updated = await prisma.$transaction(async (tx) => {
    await tx.testCategory.deleteMany({where: {testId: id}})
    return tx.test.update({
      where: {id},
      data: {
        title,
        aiTopic: theme,
        content: {description, blocks},
        testCategories: {
          create: (categoryIds as string[]).map((categoryId: string) => ({categoryId}))
        }
      },
      include: {testCategories: true}
    })
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, {params}: Params) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const {id} = await params
  const test = await prisma.test.findUnique({where: {id}, select: {teacherId: true}})
  if (!test) return NextResponse.json({error: 'Not found'}, {status: 404})

  const teacher = await prisma.teacher.findUnique({where: {email: session.user.email}, select: {id: true}})
  if (!teacher || (teacher.id !== test.teacherId && session.user.role !== 'ADMIN')) {
    return NextResponse.json({error: 'Forbidden'}, {status: 403})
  }

  await prisma.test.delete({where: {id}})
  return NextResponse.json({ok: true})
}
