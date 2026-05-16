import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [experiences, identities] = await Promise.all([
    prisma.teacherExperience.findMany({
      include: { teacher: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teacher.findMany({
      where: { passportDocumentUrl: { not: null } },
      select: { id: true, name: true, email: true, passportDocumentUrl: true, pasportConfirmed: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return NextResponse.json({ experiences, identities })
}
