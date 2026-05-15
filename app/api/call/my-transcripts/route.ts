import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rooms = await prisma.videoCallRoom.findMany({
      where: {
        ownerId: session.user.id,
        transcriptRaw: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        topic: true,
        createdAt: true,
        endedAt: true,
        transcriptRaw: true,
        transcriptJson: true,
      },
    })

    return NextResponse.json(rooms)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
