import { prisma } from '@/shared/prisma/prisma'
import { RoomServiceClient } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomName, participantIdentity } = await req.json()

    const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

    const currentIdentity = session.user.name ?? session.user.id
    if (room.ownerIdentity !== currentIdentity) {
      return NextResponse.json({ error: 'Only the room owner can kick participants' }, { status: 403 })
    }

    const apiKey = process.env.LIVEKIT_API_KEY!
    const apiSecret = process.env.LIVEKIT_API_SECRET!
    const livekitUrl = (process.env.LIVEKIT_URL ?? '').replace(/^wss?:\/\//, 'https://')

    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
    await svc.removeParticipant(roomName, participantIdentity)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
