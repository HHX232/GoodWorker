import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { text, subject } = body

    if (!text?.trim()) return NextResponse.json({ error: 'Text required' }, { status: 400 })

    const fullText = subject?.trim() ? `[${subject.trim()}]\n${text.trim()}` : text.trim()

    const complaint = await prisma.complaint.create({
      data: {
        reporterId: session.user.id,
        reporterRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        targetType: 'PLATFORM',
        targetId: 'platform',
        text: fullText,
        status: 'pending',
      },
    })

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('[POST /api/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await prisma.complaint.findMany({
      where: { reporterId: session.user.id, targetType: 'PLATFORM' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        text: true,
        status: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[GET /api/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
