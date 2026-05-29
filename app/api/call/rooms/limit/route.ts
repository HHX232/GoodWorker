import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { RoomServiceClient } from 'livekit-server-sdk'

const ROOM_PARTICIPANT_LIMIT = 3

// GET /api/call/rooms/limit?roomId=xxx
// Returns { allowed: boolean, participantCount: number, limit: number }
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const roomId = searchParams.get('roomId')
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({ where: { id: roomId } })
    if (!room) return NextResponse.json({ allowed: true, participantCount: 0, limit: ROOM_PARTICIPANT_LIMIT })

    // Check owner VIP/ADMIN status
    const ownerId = room.ownerId
    const ownerRole = room.ownerRole

    if (ownerRole === 'ADMIN') {
      return NextResponse.json({ allowed: true, participantCount: 0, limit: ROOM_PARTICIPANT_LIMIT })
    }

    // Look up isVip from DB
    let isVip = false
    if (ownerRole === 'TEACHER') {
      const teacher = await prisma.teacher.findUnique({ where: { id: ownerId }, select: { isVip: true, vipExpiresAt: true } })
      isVip = !!teacher?.isVip && (!teacher.vipExpiresAt || teacher.vipExpiresAt > new Date())
    } else {
      const student = await prisma.student.findUnique({ where: { id: ownerId }, select: { isVip: true, vipExpiresAt: true } })
      isVip = !!student?.isVip && (!student.vipExpiresAt || student.vipExpiresAt > new Date())
    }

    if (isVip) {
      return NextResponse.json({ allowed: true, participantCount: 0, limit: ROOM_PARTICIPANT_LIMIT })
    }

    // Non-VIP owner: count live participants via LiveKit
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const lkUrl = process.env.LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app'

    let participantCount = 0
    if (apiKey && apiSecret) {
      try {
        const svc = new RoomServiceClient(lkUrl.replace(/^wss?:\/\//, 'https://'), apiKey, apiSecret)
        const participants = await svc.listParticipants(room.name)
        participantCount = participants.length
      } catch {
        // LiveKit unreachable — allow join optimistically
        return NextResponse.json({ allowed: true, participantCount: 0, limit: ROOM_PARTICIPANT_LIMIT })
      }
    }

    const allowed = participantCount < ROOM_PARTICIPANT_LIMIT
    return NextResponse.json({ allowed, participantCount, limit: ROOM_PARTICIPANT_LIMIT })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
