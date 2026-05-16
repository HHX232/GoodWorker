import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { teacherId } = await params
  const { verify } = await req.json()
  const updated = await prisma.teacher.update({
    where: { id: teacherId },
    data: { pasportConfirmed: Boolean(verify) },
    select: { id: true, pasportConfirmed: true },
  })
  return NextResponse.json({ teacher: updated })
}
