import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { GUEST_PUZZLE_RATING, ratingWindows } from '@/shared/lib/chess/server/puzzleRating'
import { loadChessProfile } from '@/shared/lib/chess/server/profile'

const TAG_RE = /^[A-Za-z0-9_-]{1,80}$/
// В Lichess нет темы «двойной удар» — это вилка + вскрытое нападение (spec «Дополнения после G2»).
const THEME_ALIASES: Record<string, string[]> = { doubleAttack: ['fork', 'discoveredAttack'] }

// GET /api/chess/puzzles/next?theme=&opening=&minRating=&exclude=id,id
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams
    const theme = q.get('theme') || null
    const opening = q.get('opening') || null
    const minRatingRaw = q.get('minRating')
    const minRating = minRatingRaw ? Number(minRatingRaw) : 0
    const exclude = (q.get('exclude') ?? '').split(',').filter(Boolean).slice(0, 500)
    if ((theme && !TAG_RE.test(theme)) || (opening && !TAG_RE.test(opening)) || !Number.isFinite(minRating)) {
      return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    }

    const user = await getChatSessionUser()
    const profile = user ? await loadChessProfile(user.id) : null
    const base = Math.max(profile?.puzzleRating ?? GUEST_PUZZLE_RATING, minRating)

    const filter: Prisma.ChessPuzzleWhereInput = {
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
      ...(theme ? (THEME_ALIASES[theme] ? { themes: { hasSome: THEME_ALIASES[theme] } } : { themes: { has: theme } }) : {}),
      ...(opening ? { openingTags: { has: opening } } : {}),
    }
    // ponytail: уже решённые задачи не исключаются на сервере — клиент шлёт exclude текущей сессии; NOT IN по истории, если повторы начнут мешать.
    for (const w of ratingWindows(base)) {
      const where = { ...filter, rating: { gte: Math.max(w.min, minRating), lte: w.max } }
      const count = await prisma.chessPuzzle.count({ where })
      if (!count) continue
      const p = await prisma.chessPuzzle.findFirst({ where, skip: Math.floor(Math.random() * count), orderBy: { id: 'asc' } })
      if (!p) continue
      return NextResponse.json({
        puzzle: { id: p.id, fen: p.fen, moves: p.moves.split(' '), rating: p.rating, themes: p.themes, openingTags: p.openingTags },
        profile,
      })
    }
    return NextResponse.json({ error: 'NONE' }, { status: 404 })
  } catch (e) {
    console.error('[GET /api/chess/puzzles/next]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
