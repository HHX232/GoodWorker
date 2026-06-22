import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  const [students, teachers, posts, calls] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    (prisma.post as any).count({ where: { moderationStatus: 'PUBLISHED' } }),
    prisma.videoCallRoom.count(),
  ])

  return NextResponse.json({ students, teachers, posts, calls })
}
