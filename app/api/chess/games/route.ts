import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { checkRateLimit } from '@/shared/api/rate-limit'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { parseTimeControl } from '@/shared/lib/chess/server/online'
import { settled, START_FEN, toListItems, unauthorized } from '@/shared/lib/chess/server/onlineStore'
import { findChessPlayer } from '@/shared/lib/chess/server/progress'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// POST /api/chess/games {timeControl:'M+I', color?:'w'|'b'|'random', opponentId?} → 200 {id} · 400 · 401 · 404 (нет соперника) · 429
//   без opponentId — партия по ссылке (первый вошедший занимает место); с opponentId — вызов + уведомление сопернику.
export async function POST(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return unauthorized()
    const body = (await req.json().catch(() => null)) as { timeControl?: unknown; color?: unknown; opponentId?: unknown } | null
    const tc = parseTimeControl(body?.timeControl)
    const opponentId = body?.opponentId
    if (!tc || (opponentId !== undefined && (typeof opponentId !== 'string' || opponentId === user.id)))
      return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    if (!(await checkRateLimit(`chess-games:${user.id}`, { max: 60, windowMs: 60 * 60 * 1000 })))
      return NextResponse.json({ error: 'LIMIT' }, { status: 429 })
    const opponent = typeof opponentId === 'string' ? await findChessPlayer(opponentId) : null
    if (typeof opponentId === 'string' && !opponent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const color = body?.color === 'w' || body?.color === 'b' ? body.color : Math.random() < 0.5 ? 'w' : 'b'
    const g = await prisma.chessGame.create({
      data: {
        ...(color === 'w' ? { whiteId: user.id } : { blackId: user.id }),
        invitedId: opponent?.id ?? null,
        initialFen: START_FEN,
        timeControl: body!.timeControl as string,
        whiteMs: tc.baseMs,
        blackMs: tc.baseMs,
      },
    })
    if (opponent) {
      const me = await findChessPlayer(user.id)
      const name = me?.name ?? '—'
      const tcs = g.timeControl
      const title = { ru: 'Вызов на партию в шахматы', en: 'Chess challenge', hi: 'शतरंज की चुनौती', zh: '国际象棋挑战' }
      const text = {
        ru: `${name} вызывает вас на партию ${tcs}`,
        en: `${name} challenges you to a ${tcs} game`,
        hi: `${name} आपको ${tcs} खेल के लिए चुनौती देते हैं`,
        zh: `${name} 邀请您下一盘 ${tcs} 的棋`,
      }
      // ponytail: SYSTEM — единственный тип, который показывает ссылку (payload.html) и включён у обеих ролей; свой тип — правкой notifications.ts
      await createNotification({
        type: NOTIFICATION_TYPES.SYSTEM,
        title: title.ru,
        body: text.ru,
        titleTranslations: title,
        bodyTranslations: text,
        payload: { gameId: g.id, html: `<a href="/chess/game/${g.id}">${esc(text.ru)}</a>` },
        ...(opponent.isTeacher ? { teacherId: opponent.id } : { studentId: opponent.id }),
      }).catch((e) => console.error('[chess challenge notification]', e))
    }
    return NextResponse.json({ id: g.id })
  } catch (e) {
    console.error('[POST /api/chess/games]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/chess/games → 200 {active, invites, recent} (свои; вызовы мне; 10 последних законченных) · 401
// GET /api/chess/games?userId=<id> → 200 {recent} — 10 последних законченных партий игрока (для профиля)
export async function GET(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    const target = req.nextUrl.searchParams.get('userId')
    const recentOf = (id: string) =>
      prisma.chessGame.findMany({ where: { status: 'finished', OR: [{ whiteId: id }, { blackId: id }] }, orderBy: { updatedAt: 'desc' }, take: 10 })
    if (target) return NextResponse.json({ recent: await toListItems(await recentOf(target), target) })
    if (!user) return unauthorized()
    const mine = { OR: [{ whiteId: user.id }, { blackId: user.id }] }
    const [live, invites, recent] = await Promise.all([
      prisma.chessGame.findMany({ where: { status: { in: ['waiting', 'active'] }, ...mine }, orderBy: { updatedAt: 'desc' }, take: 20 }),
      prisma.chessGame.findMany({ where: { status: 'waiting', invitedId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      recentOf(user.id),
    ])
    // брошенные партии с вышедшим временем закрываются здесь же, а не висят «активными»
    const active = (await Promise.all(live.map((g) => settled(g)))).filter((g) => g.status === 'waiting' || g.status === 'active')
    const [a, i, r] = await Promise.all([toListItems(active, user.id), toListItems(invites, user.id), toListItems(recent, user.id)])
    return NextResponse.json({ active: a, invites: i, recent: r })
  } catch (e) {
    console.error('[GET /api/chess/games]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
