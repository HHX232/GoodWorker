import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ isVip: false })
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: session.user.id },
      select: { isVip: true, vipExpiresAt: true },
    })

    const isVip =
      teacher?.isVip === true &&
      (teacher.vipExpiresAt === null || teacher.vipExpiresAt > new Date())

    return NextResponse.json({ isVip: isVip ?? false })
  } catch (error) {
    console.error('[GET /api/teacher/vip]', error)
    return NextResponse.json({ isVip: false })
  }
}
