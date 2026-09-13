import { prisma } from '@/shared/prisma/prisma'
import { RoomServiceClient } from 'livekit-server-sdk'

// If LiveKit is unreachable (not "empty", an actual network/auth failure),
// don't guess — only fall back to closing on pure age. Mirrors
// /api/cron/close-stale-rooms's existing 8h fallback threshold.
const AGE_FALLBACK_MS = 8 * 60 * 60 * 1000

function getRoomServiceClient(): RoomServiceClient {
  const apiKey = process.env.LIVEKIT_API_KEY!
  const apiSecret = process.env.LIVEKIT_API_SECRET!
  const lkUrl = (process.env.LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app').replace(/^wss?:\/\//, 'https://')
  return new RoomServiceClient(lkUrl, apiKey, apiSecret)
}

export interface CloseRoomResult {
  closed: boolean
  reason: 'empty' | 'not_empty' | 'age_fallback' | 'age_fallback_young' | 'already_closed' | 'room_not_found'
}

// Single source of truth for "is this room actually empty, and should it be
// marked ended." Closes only when LiveKit reports zero live participants —
// NOT <= 1, which doesn't exclude the caller's own (still-connected) session
// and can close a room while another participant is still on the call.
export async function closeRoomIfEmpty(roomName: string): Promise<CloseRoomResult> {
  const room = await prisma.videoCallRoom
    .findUnique({
      where: { name: roomName },
      select: { createdAt: true, endedAt: true },
    })
    .catch(() => null)

  if (!room) return { closed: false, reason: 'room_not_found' }
  if (room.endedAt) return { closed: false, reason: 'already_closed' }

  let isEmpty: boolean | null = null
  try {
    const svc = getRoomServiceClient()
    const participants = await svc.listParticipants(roomName)
    isEmpty = participants.length === 0
  } catch {
    isEmpty = null
  }

  let shouldClose: boolean
  let reason: CloseRoomResult['reason']
  if (isEmpty === true) {
    shouldClose = true
    reason = 'empty'
  } else if (isEmpty === false) {
    shouldClose = false
    reason = 'not_empty'
  } else {
    const age = Date.now() - room.createdAt.getTime()
    shouldClose = age > AGE_FALLBACK_MS
    reason = shouldClose ? 'age_fallback' : 'age_fallback_young'
  }

  if (shouldClose) {
    await prisma.videoCallRoom.updateMany({
      where: { name: roomName, endedAt: null },
      data: { endedAt: new Date() },
    })
  }

  return { closed: shouldClose, reason }
}
