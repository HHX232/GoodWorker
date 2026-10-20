import { NextResponse } from 'next/server'
import { actionRoute, gameRoute } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/draw {action:'offer'|'accept'|'decline'} → 200 state · 400 · 401 · 403 · 404 · 409 {error:'NO_OFFER'|…, state}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/draw', async (user, g) => {
    const action = ((await req.json().catch(() => null)) as { action?: unknown } | null)?.action
    if (action !== 'offer' && action !== 'accept' && action !== 'decline') return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    return actionRoute(user, g, action)
  })
}
