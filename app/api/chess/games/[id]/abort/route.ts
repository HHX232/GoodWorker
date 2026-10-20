import { actionRoute, gameRoute } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/abort — до 2-го полухода, или ожидающая партия/вызов (в т.ч. отказ приглашённого)
//   → 200 state · 401 · 403 · 404 · 409 {error:'TOO_LATE'|…, state}
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/abort', (user, g) => actionRoute(user, g, 'abort'))
}
