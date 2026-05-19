import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const error = await prisma.studentError.findUnique({ where: { id } })
  if (!error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.studentError.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
