import { NextRequest, NextResponse } from 'next/server'
import { getLectureUser } from '@/shared/lib/lecture/access'
import { photosFromForm } from '@/shared/lib/lecture/photoInput'
import { callNotesTick } from '@/shared/lib/callNotes/session'

export const runtime = 'nodejs'
export const maxDuration = 180

const STATUS = { NOT_FOUND: 404, FORBIDDEN: 403 } as const

// POST /api/call/notes — a tick of the call's auto-notes, from the room owner's client.
// FormData {roomName, seq (ignored — kept for client compatibility; section numbers are the server's), transcript (new "Имя: текст" lines), photo × 0–6 (board tiles)}
// → {ok:true} | {ok:true, board:'failed'} (text kept, resend the board) | {ok:false, reason:'NO_AI'} (stop ticking)
// | 401/403/404 | 502 (AI failed / save conflict — resend).
export async function POST(req: NextRequest) {
  try {
    const user = await getLectureUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const form = await req.formData().catch(() => null)
    const roomName = String(form?.get('roomName') ?? '').trim()
    if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })
    const transcript = String(form?.get('transcript') ?? '').slice(-12_000)
    const photos = form?.getAll('photo').length ? await photosFromForm(form) : []
    if (photos instanceof NextResponse) return photos

    const res = await callNotesTick({ user, roomName, transcript, photos })
    if (res.reason === 'NOT_FOUND' || res.reason === 'FORBIDDEN') return NextResponse.json({ error: res.reason }, { status: STATUS[res.reason] })
    return NextResponse.json(res)
  } catch (e) {
    console.error('[POST /api/call/notes]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
