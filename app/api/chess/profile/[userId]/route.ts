import { NextResponse } from 'next/server'
import { findChessPlayer, loadChessProgress, toPublicProgress } from '@/shared/lib/chess/server/progress'

// GET /api/chess/profile/[userId] — публично: имя, аватар, рейтинги, серия, очки, значки → 200 {player, profile} · 404
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const player = await findChessPlayer(userId)
    if (!player) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ player, profile: toPublicProgress(await loadChessProgress(userId)) })
  } catch (e) {
    console.error('[GET /api/chess/profile/[userId]]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
