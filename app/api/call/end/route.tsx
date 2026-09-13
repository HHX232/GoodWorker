import { closeRoomIfEmpty } from '@/shared/lib/videoRoom/closeRoomIfEmpty'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

  const result = await closeRoomIfEmpty(roomName)
  return NextResponse.json({ ok: true, closed: result.closed, reason: result.reason })
}
