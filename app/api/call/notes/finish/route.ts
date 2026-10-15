import { after, NextRequest, NextResponse } from 'next/server'
import { getLectureUser } from '@/shared/lib/lecture/access'
import { finishCallNotes, ownedRoom } from '@/shared/lib/callNotes/session'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/call/notes/finish {roomName} — the room owner left: name the notes and file a
// copy for every participant. Answers 202 at once; the work runs after the response
// (idempotent — a second call, or /api/call/end, does nothing).
export async function POST(req: NextRequest) {
  const user = await getLectureUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { roomName } = await req.json().catch(() => ({}))
  if (typeof roomName !== 'string' || !roomName.trim()) return NextResponse.json({ error: 'roomName required' }, { status: 400 })
  const room = await ownedRoom(roomName.trim(), user)
  if (room === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (room === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  after(() => finishCallNotes(roomName.trim()))
  return NextResponse.json({ ok: true }, { status: 202 })
}
