import { AccessToken } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName?.trim()) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  const identity = session.user.name ?? session.user.id
  // Who was on the call (the call-notes finale files a copy for each) — never blocks the token.
  try {
    const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName.trim() }, select: { id: true } })
    const userRole = session.user.role === 'STUDENT' || session.user.role === 'TEACHER' || session.user.role === 'ADMIN' ? session.user.role : null
    if (room) {
      // One row per user (namesakes share a display name, not an id).
      const id = `${room.id}::${session.user.id}`
      await prisma.videoCallParticipant.upsert({
        where: { id },
        create: { id, roomId: room.id, identity, userId: session.user.id, userRole },
        update: { userId: session.user.id, userRole },
      })
    }
  } catch (e) {
    console.error('[livekit/token] participant upsert failed', e)
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: 3600,
  })
  at.addGrant({ roomJoin: true, room: roomName.trim(), canPublish: true, canSubscribe: true })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
