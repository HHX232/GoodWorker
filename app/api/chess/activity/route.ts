import { NextRequest, NextResponse } from 'next/server'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { checkRateLimit } from '@/shared/api/rate-limit'
import { parseActivity, recordChessActivity } from '@/shared/lib/chess/server/progress'

// POST /api/chess/activity {kind:'bot'|'puzzle'|'storm', tzOffsetMin, botLevel?, result?, plies?, score?}
//   → 200 {profile, newBadges, streakChanged} · 401 · 400 {error:'BAD_INPUT'} · 429 {error:'LIMIT'}
// 'online' сюда не принимается — его пишет сервер онлайн-партии (T12) сам.
export async function POST(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const input = parseActivity(await req.json().catch(() => null))
    if (!input || input.kind === 'online') return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    // ponytail: клиенту верим на слово (партия с ботом идёт в браузере); лимит лишь режет скриптовый фарм
    if (!(await checkRateLimit(`chess-activity:${user.id}`, { max: 120, windowMs: 60 * 60 * 1000 })))
      return NextResponse.json({ error: 'LIMIT' }, { status: 429 })
    return NextResponse.json(await recordChessActivity(user.id, input))
  } catch (e) {
    console.error('[POST /api/chess/activity]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
