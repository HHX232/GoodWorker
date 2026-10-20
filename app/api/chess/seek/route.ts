import { NextRequest, NextResponse } from 'next/server'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { parseTimeControl } from '@/shared/lib/chess/server/online'
import { cancelSeek, seekMatch, unauthorized } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/seek {timeControl} — быстрый подбор; клиент повторяет его как опрос, пока ждёт.
//   → 200 {gameId} (партия найдена — своя или созданная соперником) · 200 {waiting:true, window} · 400 · 401
export async function POST(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return unauthorized()
    const timeControl = ((await req.json().catch(() => null)) as { timeControl?: unknown } | null)?.timeControl
    const tc = parseTimeControl(timeControl)
    if (!tc || typeof timeControl !== 'string') return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    return NextResponse.json(await seekMatch(user.id, timeControl))
  } catch (e) {
    console.error('[POST /api/chess/seek]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/chess/seek — отмена ожидания → 200 {gameId: string|null} (если соперник успел найтись — партия всё равно отдаётся) · 401
export async function DELETE() {
  try {
    const user = await getChatSessionUser()
    if (!user) return unauthorized()
    return NextResponse.json({ gameId: await cancelSeek(user.id) })
  } catch (e) {
    console.error('[DELETE /api/chess/seek]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
