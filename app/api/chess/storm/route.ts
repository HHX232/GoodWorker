import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { checkRateLimit } from '@/shared/api/rate-limit'
import { parseActivity, recordChessActivity } from '@/shared/lib/chess/server/progress'

// POST /api/chess/storm {mode: 3|5, score, tzOffsetMin}
//   → 200 {best, record: boolean, profile, newBadges, streakChanged} · 401 · 400 {error:'BAD_INPUT'} · 429 {error:'LIMIT'}
export async function POST(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const mode = body?.mode
    const input = parseActivity({ ...body, kind: 'storm' })
    if ((mode !== 3 && mode !== 5) || !input) return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    // ponytail: the score is counted in the browser and trusted; a server-side run (puzzle ids + moves) if storm VIP rewards appear
    if (!(await checkRateLimit(`chess-storm:${user.id}`, { max: 60, windowMs: 60 * 60 * 1000 })))
      return NextResponse.json({ error: 'LIMIT' }, { status: 429 })

    const score = input.score ?? 0
    const field = mode === 3 ? 'stormBest3' : 'stormBest5'
    const before = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "ChessProfile" ("userId", "updatedAt") VALUES (${user.id}, NOW()) ON CONFLICT ("userId") DO NOTHING`
      await tx.$queryRaw`SELECT 1 FROM "ChessProfile" WHERE "userId" = ${user.id} FOR UPDATE` // two tabs finishing at once keep the higher score
      const cur = await tx.chessProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { stormBest3: true, stormBest5: true } })
      if (score > cur[field]) await tx.chessProfile.update({ where: { userId: user.id }, data: { [field]: score } })
      return cur[field]
    })
    const activity = await recordChessActivity(user.id, input)
    return NextResponse.json({ best: Math.max(before, score), record: score > before, ...activity })
  } catch (e) {
    console.error('[POST /api/chess/storm]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
