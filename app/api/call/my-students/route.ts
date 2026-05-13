import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'TEACHER') return NextResponse.json({ students: [] })

    const rows = await prisma.teacherStudent.findMany({
      where: { teacherId: session.user.id },
      include: { student: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return NextResponse.json({ students: rows.map((r) => r.student) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
