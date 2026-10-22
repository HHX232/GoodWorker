import { closeRoomIfEmpty } from '@/shared/lib/videoRoom/closeRoomIfEmpty'
import { after, NextRequest, NextResponse } from 'next/server'
import { finishCallNotes } from '@/shared/lib/callNotes/session'
import { auth } from '../../../../auth'

// The call-notes finale may run after the response.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

  const result = await closeRoomIfEmpty(roomName)
  // The owner closed the tab without "Выйти" — the call's notes still get filed (idempotent).
  if (result.closed) after(() => finishCallNotes(roomName))
  return NextResponse.json({ ok: true, closed: result.closed, reason: result.reason })
}
