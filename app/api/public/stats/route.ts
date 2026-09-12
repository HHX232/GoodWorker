import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [students, teachers, courses, calls] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.roadmap.count({ where: { moderationStatus: 'PUBLISHED' } }),
    prisma.videoCallRoom.count(),
  ])

  return NextResponse.json({ students, teachers, courses, calls })
}
