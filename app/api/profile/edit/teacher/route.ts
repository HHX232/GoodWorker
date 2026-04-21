import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../auth'

const updateTeacherSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().min(7, 'Minimum 7 characters').optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateTeacherSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id  },
  })

  if (!teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const updated = await prisma.teacher.update({
    where: { id: teacher.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
      ...(parsed.data.avatarUrl !== undefined && { avatarUrl: parsed.data.avatarUrl }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      langCode: true,
    },
  })

  return NextResponse.json(updated)
}