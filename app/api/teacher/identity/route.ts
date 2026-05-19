import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: { passportDocumentUrl: true, pasportConfirmed: true },
  })
  return NextResponse.json(teacher ?? {})
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { passportDocumentUrl } = await req.json()
  await prisma.teacher.update({
    where: { id: session.user.id },
    data: { passportDocumentUrl: passportDocumentUrl ?? null },
  })
  return NextResponse.json({ ok: true })
}
