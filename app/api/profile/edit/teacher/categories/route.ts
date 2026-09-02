import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../../auth'

const updateCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).min(1, 'At least one category is required').max(30),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateCategoriesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const teacher = await prisma.teacher.findUnique({ where: { id: session.user.id } })
  if (!teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const categoryIds = Array.from(new Set(parsed.data.categoryIds))
  const validCount = await prisma.category.count({ where: { id: { in: categoryIds } } })
  if (validCount !== categoryIds.length) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  const categories = await prisma.$transaction(async (tx) => {
    await tx.teacherCategory.deleteMany({ where: { teacherId: teacher.id } })
    await tx.teacherCategory.createMany({
      data: categoryIds.map((categoryId) => ({ teacherId: teacher.id, categoryId })),
    })
    return tx.teacherCategory.findMany({
      where: { teacherId: teacher.id },
      select: { category: { select: { id: true, slug: true, translations: true } } },
    })
  })

  return NextResponse.json({ categories })
}
