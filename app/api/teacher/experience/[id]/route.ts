import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const exp = await prisma.teacherExperience.findUnique({ where: { id } })
  if (!exp || exp.teacherId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.teacherExperience.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const exp = await prisma.teacherExperience.findUnique({ where: { id } })
  if (!exp || exp.teacherId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { documentUrls } = await req.json()
  const updated = await prisma.teacherExperience.update({ where: { id }, data: { documentUrls: documentUrls ?? [] } })
  return NextResponse.json({ experience: updated })
}
