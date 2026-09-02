import {prisma} from '@/shared/prisma/prisma'
import {RoomServiceClient} from 'livekit-server-sdk'
import {NextRequest, NextResponse} from 'next/server'

// Rooms are only ever marked ended by the client itself (beforeunload beacon,
// or the normal hang-up flow) — nothing server-side is authoritative, so a
// crashed tab / lost network / force-quit leaves a room "active" forever
// (see /api/call/end for the same client-triggered pattern this mirrors).
// This endpoint is meant to be hit by an external scheduler every ~10
// minutes to reconcile our DB against LiveKit's actual live room state.
//
// A brand-new room can legitimately have 0 participants for the first
// minute or two (creator hasn't joined yet), so anything younger than
// GRACE_MS is left alone even if LiveKit reports it empty.
const GRACE_MS = 5 * 60 * 1000
// If LiveKit itself can't be reached (not "room not found" — an actual
// network/auth failure), don't guess: only fall back to closing on pure age,
// mirroring /api/call/end's existing 8h fallback threshold.
const AGE_FALLBACK_MS = 8 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const lkUrl = (process.env.LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app').replace(/^wss?:\/\//, 'https://')
  if (!apiKey || !apiSecret) {
    return NextResponse.json({error: 'LiveKit not configured'}, {status: 500})
  }
  const svc = new RoomServiceClient(lkUrl, apiKey, apiSecret)

  const activeRooms = await prisma.videoCallRoom.findMany({
    where: {endedAt: null},
    select: {id: true, name: true, createdAt: true}
  })

  const now = Date.now()
  let closed = 0
  const closedIds: string[] = []

  for (const room of activeRooms) {
    const age = now - room.createdAt.getTime()
    let shouldClose = false

    try {
      const participants = await svc.listParticipants(room.name)
      shouldClose = participants.length === 0 && age > GRACE_MS
    } catch {
      // LiveKit couldn't find the room at all (its own empty-timeout already
      // expired it) or is unreachable — either way we can't confirm live
      // state, so only close once the room is old enough that "still
      // genuinely active" is implausible.
      shouldClose = age > AGE_FALLBACK_MS
    }

    if (shouldClose) {
      closedIds.push(room.id)
      closed++
    }
  }

  if (closedIds.length) {
    await prisma.videoCallRoom.updateMany({
      where: {id: {in: closedIds}, endedAt: null},
      data: {endedAt: new Date()}
    })
  }

  return NextResponse.json({ok: true, checked: activeRooms.length, closed})
}
