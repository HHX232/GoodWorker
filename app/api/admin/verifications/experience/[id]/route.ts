import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const exp = await prisma.teacherExperience.findUnique({ where: { id } })
  if (!exp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { verify } = await req.json()
  if (verify && exp.documentUrls.length === 0) return NextResponse.json({ error: 'Cannot verify without documents' }, { status: 400 })
  const updated = await prisma.teacherExperience.update({
    where: { id },
    data: {
      verifiedAt: verify ? new Date() : null,
      verifiedByAdmin: verify ? session.user.id : null,
    },
  })
  return NextResponse.json({ experience: updated })
}
