import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../auth'
import { refineNameTransliterationWithAI } from '@/lib/postAI'
import { hasAIProvider } from '@/lib/openrouter'

const updateStudentSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z
  .string()
  .transform((v) => (v?.trim() === '' ? null : v))
  .pipe(z.string().min(7, 'Minimum 7 characters').nullable())
  .optional()
  .nullable(),
  avatarUrl: z.string().optional().nullable(), 
})

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
 console.log('SESSION:', JSON.stringify(session, null, 2))
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateStudentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const student = await prisma.student.findUnique({
    where: { id: session.user.id },
  })

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const updated = await prisma.student.update({
    where: { id: student.id },
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

  if (parsed.data.name && hasAIProvider()) {
    refineNameTransliterationWithAI(parsed.data.name, student.id, 'student').catch(() => {})
  }

  return NextResponse.json(updated)
}
