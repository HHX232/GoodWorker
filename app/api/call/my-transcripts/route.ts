import { prisma } from '@/shared/prisma/prisma'
import { getLectureUser } from '@/shared/lib/lecture/access'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getLectureUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // My call notes: one per room (unique callRoomId+owner). Rooms where I was only a participant show up through them.
    const notes = await prisma.lectureNote.findMany({
      where: { ownerId: user.id, ownerRole: user.role, callRoomId: { not: null } },
      select: { id: true, callRoomId: true },
    })
    const noteByRoom = new Map(notes.map(n => [n.callRoomId as string, n.id]))

    const rooms = await prisma.videoCallRoom.findMany({
      where: {
        OR: [
          { ownerId: user.id, transcriptRaw: { not: null } },
          { id: { in: [...noteByRoom.keys()] } },
        ],
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
        ownerId: true,
      },
    })

    // A participant gets only their own notes, never the owner's raw transcript.
    return NextResponse.json(rooms.map(({ ownerId, ...r }) => ({
      ...r,
      ...(ownerId === user.id ? {} : { transcriptRaw: null, transcriptJson: null }),
      noteId: noteByRoom.get(r.id) ?? null,
    })))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 })
  }
}
