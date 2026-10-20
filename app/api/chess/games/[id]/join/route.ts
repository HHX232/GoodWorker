import { gameRoute, joinGame } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/join → 200 state (партия началась; уже участник — просто состояние) · 401 · 403 (вызов не тебе) · 404 · 409 {error:'TAKEN', state}
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/join', (user, g) => joinGame(user, g))
}
