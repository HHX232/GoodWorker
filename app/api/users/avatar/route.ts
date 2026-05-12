import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'

export async function GET(req: NextRequest) {
  const identity = req.nextUrl.searchParams.get('identity')
  if (!identity) return NextResponse.json({ avatarUrl: null })

  try {
    const student = await prisma.student.findFirst({ where: { name: identity }, select: { avatarUrl: true } })
    if (student?.avatarUrl) return NextResponse.json({ avatarUrl: student.avatarUrl })

    const teacher = await prisma.teacher.findFirst({ where: { name: identity }, select: { avatarUrl: true } })
    if (teacher?.avatarUrl) return NextResponse.json({ avatarUrl: teacher.avatarUrl })
  } catch {}

  return NextResponse.json({ avatarUrl: null })
}
