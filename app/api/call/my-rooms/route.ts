import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rooms = await prisma.videoCallRoom.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        topic: true,
        createdAt: true,
        endedAt: true,
        transcriptRaw: true,
      },
    })

    return NextResponse.json(rooms.map(({ transcriptRaw, ...r }) => ({
      ...r,
      hasTranscript: !!transcriptRaw,
    })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
