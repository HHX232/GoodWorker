import { NextResponse } from 'next/server'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { findChessPlayer, loadChessProgress } from '@/shared/lib/chess/server/progress'

// GET /api/chess/profile/me → 200 {player, profile} · 401
export async function GET() {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [player, profile] = await Promise.all([findChessPlayer(user.id), loadChessProgress(user.id)])
    return NextResponse.json({ player, profile })
  } catch (e) {
    console.error('[GET /api/chess/profile/me]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
