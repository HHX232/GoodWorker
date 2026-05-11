import { prisma } from '@/shared/prisma/prisma'
import { RoomServiceClient } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName, participantIdentity, trackSid, muted } = await req.json()

  const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const currentIdentity = session.user.name ?? session.user.id
  if (room.ownerIdentity !== currentIdentity) {
    return NextResponse.json({ error: 'Only the room owner can mute participants' }, { status: 403 })
  }

  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const livekitUrl = (process.env.LIVEKIT_URL ?? '').replace(/^wss?:\/\//, 'https://')

  const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
  await svc.mutePublishedTrack(roomName, participantIdentity, trackSid, muted ?? true)

  return NextResponse.json({ ok: true })
}
