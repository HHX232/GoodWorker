import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hwId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hwId } = await params

    const homework = await prisma.homework.findUnique({
      where: { id: hwId, teacherId: session.user.id },
      include: {
        assignments: {
          select: { id: true, studentId: true, status: true },
        },
      },
    })

    if (!homework) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      homework: {
        id: homework.id,
        title: homework.title,
        content: homework.content,
        dueAt: homework.dueAt?.toISOString() ?? null,
        sendAt: homework.sendAt?.toISOString() ?? null,
        createdAt: homework.createdAt.toISOString(),
        assignmentCount: homework.assignments.length,
      },
    })
  } catch (e) {
    console.error('[GET /api/homework/hw/[hwId]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ hwId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { hwId } = await params
    const body = await req.json()
    const { title, content, dueAt, sendAt } = body

    const existing = await prisma.homework.findUnique({
      where: { id: hwId, teacherId: session.user.id },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.homework.update({
      where: { id: hwId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content }),
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        ...(sendAt !== undefined && { sendAt: sendAt ? new Date(sendAt) : null }),
      },
    })

    return NextResponse.json({ homework: { id: updated.id } })
  } catch (e) {
    console.error('[PATCH /api/homework/hw/[hwId]]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
