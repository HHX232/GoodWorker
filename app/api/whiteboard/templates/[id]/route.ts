import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await prisma.whiteboardTemplate.findUnique({ where: { id }, select: { teacherId: true } })
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (template.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.whiteboardTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/whiteboard/templates/[id]]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
