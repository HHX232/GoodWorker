import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.whiteboardTemplate.findMany({
      where: { teacherId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, snapshot: true, createdAt: true },
    })
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[GET /api/whiteboard/templates]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, snapshot } = await req.json()
    const trimmedName = (name ?? '').toString().trim().slice(0, 120)
    if (!trimmedName) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      return NextResponse.json({ error: 'snapshot required' }, { status: 400 })
    }

    const template = await prisma.whiteboardTemplate.create({
      data: { teacherId: session.user.id, name: trimmedName, snapshot },
      select: { id: true, name: true, snapshot: true, createdAt: true },
    })
    return NextResponse.json({ template })
  } catch (error) {
    console.error('[POST /api/whiteboard/templates]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
