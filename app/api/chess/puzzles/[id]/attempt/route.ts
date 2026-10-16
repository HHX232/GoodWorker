import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { GUEST_PUZZLE_RATING, nextPuzzleRating } from '@/shared/lib/chess/server/puzzleRating'
import { loadChessProfile } from '@/shared/lib/chess/server/profile'

// POST /api/chess/puzzles/[id]/attempt {solved} — каждая попытка пишется; рейтинг и счётчики меняет только первая по задаче.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (typeof body?.solved !== 'boolean') return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    const solved: boolean = body.solved

    const puzzle = await prisma.chessPuzzle.findUnique({ where: { id }, select: { rating: true } })
    if (!puzzle) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    // ponytail: транзакция READ COMMITTED — при параллельных первых попытках (в т.ч. по разным задачам) обе читают
    // один и тот же рейтинг, и одно обновление теряется; Serializable или SELECT … FOR UPDATE по профилю, если станет важно.
    await prisma.$transaction(async tx => {
      const first = !(await tx.chessPuzzleAttempt.findFirst({ where: { userId: user.id, puzzleId: id }, select: { id: true } }))
      await tx.chessPuzzleAttempt.create({ data: { userId: user.id, puzzleId: id, solved } })
      if (!first) return
      const cur = await tx.chessProfile.findUnique({ where: { userId: user.id }, select: { puzzleRating: true } })
      const puzzleRating = nextPuzzleRating(cur?.puzzleRating ?? GUEST_PUZZLE_RATING, puzzle.rating, solved)
      await tx.chessProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, puzzleRating, solved: solved ? 1 : 0, failed: solved ? 0 : 1 },
        update: { puzzleRating, ...(solved ? { solved: { increment: 1 } } : { failed: { increment: 1 } }) },
      })
    })
    return NextResponse.json({ profile: await loadChessProfile(user.id) })
  } catch (e) {
    console.error('[POST /api/chess/puzzles/[id]/attempt]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
