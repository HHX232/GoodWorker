import { NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { loadChessProfile } from '@/shared/lib/chess/server/profile'

// GET /api/chess/progress → {profile, byTheme: {<lichess theme>: {solved: <различных решённых задач>}}}
export async function GET() {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await prisma.$queryRaw<{ theme: string; n: bigint }[]>`
      SELECT t AS theme, count(DISTINCT a."puzzleId") AS n
      FROM "ChessPuzzleAttempt" a JOIN "ChessPuzzle" p ON p."id" = a."puzzleId", unnest(p."themes") t
      WHERE a."userId" = ${user.id} AND a."solved"
      GROUP BY t`
    const byTheme: Record<string, { solved: number }> = {}
    for (const r of rows) byTheme[r.theme] = { solved: Number(r.n) }
    return NextResponse.json({ profile: await loadChessProfile(user.id), byTheme })
  } catch (e) {
    console.error('[GET /api/chess/progress]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
