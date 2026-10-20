import { actionRoute, gameRoute } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/resign → 200 state · 401 · 403 · 404 · 409 {error, state}
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/resign', (user, g) => actionRoute(user, g, 'resign'))
}
