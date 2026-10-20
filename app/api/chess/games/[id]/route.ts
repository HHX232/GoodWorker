import { NextRequest, NextResponse } from 'next/server'
import { gameRoute, settled, toState } from '@/shared/lib/chess/server/onlineStore'

// GET /api/chess/games/[id]?since=<ply> → 200 OnlineGameState (с since — только хвост ходов и без игроков: опрос раз в ~1 с)
//   · 401 · 404. Флаг по времени проверяется и здесь.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'GET /api/chess/games/[id]', async (user, g) => {
    const raw = req.nextUrl.searchParams.get('since')
    const since = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null
    return NextResponse.json(await toState(await settled(g), user.id, since))
  })
}
