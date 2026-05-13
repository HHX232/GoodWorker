import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// POST /api/call/transcript — save transcript after a call ends
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomName, transcriptRaw, transcriptJson, participants } = await req.json()
    if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

    await prisma.videoCallRoom.update({
      where: { id: room.id },
      data: {
        endedAt: new Date(),
        transcriptRaw: transcriptRaw ?? null,
        transcriptJson: transcriptJson ?? null,
      },
    })

    // Upsert participants by identity — prevents duplicates if called multiple times
    if (Array.isArray(participants) && participants.length > 0) {
      await prisma.$transaction(
        participants.map((p: { identity: string; userId?: string; userRole?: string }) =>
          prisma.videoCallParticipant.upsert({
            where: {
              // Use a compound unique — we don't have one, so use create only if not exists
              id: `${room.id}::${p.identity}`,
            },
            create: {
              id: `${room.id}::${p.identity}`,
              roomId: room.id,
              identity: p.identity,
              userId: p.userId ?? null,
              userRole: (p.userRole as any) ?? null,
            },
            update: {},
          })
        )
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// GET /api/call/transcript?roomName=xxx — fetch transcript
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roomName = new URL(req.url).searchParams.get('roomName')
    if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({
      where: { name: roomName },
      include: { participants: true },
    })
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      transcriptRaw: room.transcriptRaw,
      transcriptJson: room.transcriptJson,
      participants: room.participants,
      endedAt: room.endedAt,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
