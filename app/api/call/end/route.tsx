import { prisma } from '@/shared/prisma/prisma'
import { RoomServiceClient } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const svc = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

  let shouldClose = false

  // ── 1. Спрашиваем LiveKit ─────────────────────────────────────────────────
  try {
    const participants = await svc.listParticipants(roomName)
    shouldClose = participants.length <= 1
  } catch {
    // LiveKit недоступен или комната уже удалена — переходим к fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shouldClose = null as any // помечаем что нужен fallback
  }

  // ── 2. Fallback: смотрим на createdAt если LiveKit не ответил ────────────
  if (shouldClose === null) {
    try {
      const room = await prisma.videoCallRoom.findUnique({
        where: { name: roomName },
        select: { createdAt: true, endedAt: true },
      })

      if (!room || room.endedAt) {
        return NextResponse.json({ ok: true, reason: 'already_closed' })
      }

      // Если комната существует больше 8 часов — точно закрываем
      const ageHours = (Date.now() - room.createdAt.getTime()) / 3_600_000
      shouldClose = ageHours > 8
    } catch {
      // Даже Prisma не ответил — ничего не делаем, не ломаем
      return NextResponse.json({ ok: true, reason: 'fallback_failed' })
    }
  }

  // ── 3. Закрываем если решили ──────────────────────────────────────────────
  if (shouldClose) {
    await prisma.videoCallRoom.updateMany({
      where: { name: roomName, endedAt: null },
      data: { endedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true, closed: shouldClose })
}