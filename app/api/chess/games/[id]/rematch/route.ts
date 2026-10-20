import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'
import { parseTimeControl } from '@/shared/lib/chess/server/online'
import { conflict, gameRoute, joinGame, sideOf } from '@/shared/lib/chess/server/onlineStore'

// POST /api/chess/games/[id]/rematch — первый нажавший создаёт вызов (цвета меняются), второй его принимает
//   → 200 {id} · 401 · 403 · 404 · 409 {error:'NOT_OVER', state}
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return gameRoute(params, 'POST /api/chess/games/[id]/rematch', async (user, g) => {
    const side = sideOf(g, user.id)
    if (!side) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    if (g.status !== 'finished' && g.status !== 'aborted') return conflict('NOT_OVER', g.id, user.id)
    const opponent = side === 'w' ? g.blackId : g.whiteId
    if (!opponent) return conflict('NOT_OVER', g.id, user.id)
    const accept = async () => {
      const r = await prisma.chessGame.findUniqueOrThrow({ where: { rematchOf: g.id } })
      if (r.invitedId === user.id && r.status === 'waiting') {
        const res = await joinGame(user, r)
        if (!res.ok) return res
      }
      return NextResponse.json({ id: r.id })
    }
    if (await prisma.chessGame.findUnique({ where: { rematchOf: g.id }, select: { id: true } })) return accept()
    try {
      const r = await prisma.chessGame.create({
        data: {
          ...(side === 'w' ? { blackId: user.id } : { whiteId: user.id }),
          invitedId: opponent,
          rematchOf: g.id,
          initialFen: g.initialFen,
          timeControl: g.timeControl,
          whiteMs: parseTimeControl(g.timeControl)!.baseMs,
          blackMs: parseTimeControl(g.timeControl)!.baseMs,
          rated: g.rated,
        },
      })
      return NextResponse.json({ id: r.id })
    } catch (e) {
      // оба нажали одновременно: уникальный rematchOf пропустил одного — второй принимает его вызов
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return accept()
      throw e
    }
  })
}
