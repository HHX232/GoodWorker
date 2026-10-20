import { NextResponse } from 'next/server'
import { applyMove } from '@/shared/lib/chess/server/online'
import { asCore, commit, conflict, gameRoute, sideOf, toState } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/move {uci, ply /*сколько ходов видел клиент*/}
//   → 200 state · 400 {error:'BAD_INPUT'|'ILLEGAL'} · 401 · 403 · 404 · 409 {error:'STALE'|'NOT_YOUR_TURN'|'NOT_ACTIVE'|'GAME_OVER'|'CONFLICT', state}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/move', async (user, g) => {
    const side = sideOf(g, user.id)
    if (!side) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    const body = (await req.json().catch(() => null)) as { uci?: unknown; ply?: unknown } | null
    const { uci, ply } = body ?? {}
    if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || !Number.isInteger(ply))
      return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    const now = new Date()
    const r = applyMove(asCore(g), side, uci, ply as number, now)
    if (!r.ok) {
      if (r.patch) await commit(g, r.patch, now)
      return r.error === 'ILLEGAL' ? NextResponse.json({ error: 'ILLEGAL' }, { status: 400 }) : conflict(r.error, g.id, user.id)
    }
    // условный update по updatedAt: второй одновременный ход с тем же ply сюда не пройдёт
    const next = await commit(g, r.patch, now)
    return next ? NextResponse.json(await toState(next, user.id, null)) : conflict('STALE', g.id, user.id)
  })
}
