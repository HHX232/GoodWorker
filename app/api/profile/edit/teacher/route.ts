import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../auth'

const urlOrEmpty = z.string().refine(
  v => !v || /^https?:\/\/.+/.test(v),
  { message: 'Must be a valid URL' }
).optional().nullable()

const socialLinksSchema = z.object({
  vk:        urlOrEmpty,
  telegram:  urlOrEmpty,
  instagram: urlOrEmpty,
  youtube:   urlOrEmpty,
  website:   urlOrEmpty,
}).optional().nullable()

const updateTeacherSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z
    .string()
    .transform((v) => (v?.trim() === '' ? null : v))
    .pipe(z.string().min(7, 'Minimum 7 characters').nullable())
    .optional()
    .nullable(),
  avatarUrl:     z.string().optional().nullable(),
  bio:           z.string().max(2000).optional().nullable(),
  coverPhotoUrl: z.string().optional().nullable(),
  socialLinks:   socialLinksSchema,
  languages:     z.array(z.string()).optional(),
  serviceLabels: z.array(z.string().max(60)).max(20).optional(),
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
    where: { id: session.user.id },
  })

  if (!teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const updated = await prisma.teacher.update({
    where: { id: teacher.id },
    data: {
      ...(parsed.data.name           !== undefined && { name:           parsed.data.name }),
      ...(parsed.data.phone          !== undefined && { phone:          parsed.data.phone }),
      ...(parsed.data.avatarUrl      !== undefined && { avatarUrl:      parsed.data.avatarUrl }),
      ...(parsed.data.bio            !== undefined && { bio:            parsed.data.bio }),
      ...(parsed.data.coverPhotoUrl  !== undefined && { coverPhotoUrl:  parsed.data.coverPhotoUrl }),
      ...(parsed.data.socialLinks    !== undefined && { socialLinks:    parsed.data.socialLinks ?? undefined }),
      ...(parsed.data.languages      !== undefined && parsed.data.languages.length > 0 && { languages: parsed.data.languages }),
      ...(parsed.data.serviceLabels  !== undefined && { serviceLabels: parsed.data.serviceLabels }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      langCode: true,
      bio: true,
      coverPhotoUrl: true,
      socialLinks: true,
      languages: true,
    },
  })

  return NextResponse.json(updated)
}
