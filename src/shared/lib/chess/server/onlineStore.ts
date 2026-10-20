// Онлайн-партии: Prisma-обвязка чистого ядра online.ts. Каждое изменение партии — условный update по updatedAt
// (оптимистичная блокировка): из двух одновременных запросов проходит один, второй получает 409 и свежее состояние.
import { NextResponse } from 'next/server'
import type { ChessGame } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { applyAction, clocksAt, eloDeltas, moveList, parseTimeControl, pickOpponent, seekWindow, settle, sideToMove, type GameAction, type GamePatch, type GameResult, type OnlineGame, type Side } from './online'
import { findChessPlayer, recordChessActivity } from './progress'

export type PlayerHit = { id: string; name: string; avatarUrl: string | null; isTeacher: boolean; isChessTutor: boolean; rating: number }
export type OnlinePlayer = { id: string; name: string; avatarUrl: string | null; rating: number | null }
export type OnlineGameState = {
  id: string
  status: OnlineGame['status']
  result: GameResult | null
  termination: string | null
  timeControl: string
  rated: boolean
  initialFen: string
  ply: number
  since: number // moves — хвост партии начиная с этого полухода
  moves: string[]
  turn: Side
  whiteMs: number
  blackMs: number
  serverNow: number
  drawOfferBy: Side | null
  you: Side | null
  whiteDelta: number | null
  blackDelta: number | null
  rematchId: string | null
  canJoin: boolean // ожидающая партия, которую этот пользователь может занять (ссылка или вызов ему)
  // только в полном ответе (без ?since=)
  white?: OnlinePlayer | null
  black?: OnlinePlayer | null
  invited?: OnlinePlayer | null
}

export const asCore = (g: ChessGame): OnlineGame => g as unknown as OnlineGame // строковые поля в БД — те же литералы
export const sideOf = (g: ChessGame, userId: string): Side | null => (g.whiteId === userId ? 'w' : g.blackId === userId ? 'b' : null)

type User = NonNullable<Awaited<ReturnType<typeof getChatSessionUser>>>
export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

/** Обвязка роутов /api/chess/games/[id]/*: вошедший (иначе 401), партия (иначе 404), 500 с логом. */
export async function gameRoute(params: Promise<{ id: string }>, tag: string, fn: (user: User, g: ChessGame) => Promise<Response>) {
  try {
    const user = await getChatSessionUser()
    if (!user) return unauthorized()
    const g = await prisma.chessGame.findUnique({ where: { id: (await params).id } })
    if (!g) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    return await fn(user, g)
  } catch (e) {
    console.error(`[${tag}]`, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Ответ на отказ: код ошибки + свежее состояние, чтобы клиент сразу догнал партию. */
export async function conflict(error: string, gameId: string, userId: string, status = 409) {
  const g = await prisma.chessGame.findUniqueOrThrow({ where: { id: gameId } })
  return NextResponse.json({ error, state: await toState(g, userId, null) }, { status })
}

/** Сдача / ничья / отмена. Отменить ожидающий вызов может и приглашённый (места у него ещё нет). */
export async function actionRoute(user: User, g: ChessGame, action: GameAction) {
  const side = sideOf(g, user.id) ?? (action === 'abort' && g.invitedId === user.id ? 'w' : null)
  if (!side) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const now = new Date()
  const r = applyAction(asCore(g), side, action, now)
  if (!r.ok) {
    if (r.patch) await commit(g, r.patch, now)
    return conflict(r.error, g.id, user.id)
  }
  const next = await commit(g, r.patch, now)
  return next ? NextResponse.json(await toState(next, user.id, null)) : conflict('CONFLICT', g.id, user.id)
}

export async function ratingOf(userId: string): Promise<number> {
  return (await prisma.chessProfile.findUnique({ where: { userId }, select: { rating: true } }))?.rating ?? 1200
}

/**
 * Применить patch, если партию никто не изменил после чтения. null — гонка проиграна.
 * Если patch завершает рейтинговую партию — Эло обоих в той же транзакции, затем recordChessActivity('online').
 */
export async function commit(g: ChessGame, patch: GamePatch & Partial<ChessGame>, now = new Date()): Promise<ChessGame | null> {
  const finishing = patch.status === 'finished' && g.status !== 'finished'
  const next = await prisma.$transaction(async (tx) => {
    // снимок устарел, если сменились ходы или статус: двойной ход и двойное Эло не проходят даже при совпавшем updatedAt
    const n = await tx.chessGame.updateMany({
      where: { id: g.id, updatedAt: g.updatedAt, moves: g.moves, status: g.status },
      data: { ...patch, updatedAt: now },
    })
    if (!n.count) return null
    if (finishing && g.rated && g.whiteId && g.blackId && patch.result) {
      const ids = [g.whiteId, g.blackId]
      for (const id of ids) await tx.$executeRaw`INSERT INTO "ChessProfile" ("userId", "updatedAt") VALUES (${id}, NOW()) ON CONFLICT ("userId") DO NOTHING`
      await tx.$queryRaw`SELECT 1 FROM "ChessProfile" WHERE "userId" IN (${ids[0]}, ${ids[1]}) ORDER BY "userId" FOR UPDATE`
      const rows = await tx.chessProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, rating: true } })
      const r = (id: string) => rows.find((x) => x.userId === id)?.rating ?? 1200
      const d = eloDeltas(r(g.whiteId), r(g.blackId), patch.result)
      await tx.chessProfile.update({ where: { userId: g.whiteId }, data: { rating: { increment: d.white }, ratingGames: { increment: 1 } } })
      await tx.chessProfile.update({ where: { userId: g.blackId }, data: { rating: { increment: d.black }, ratingGames: { increment: 1 } } })
      await tx.chessGame.update({ where: { id: g.id }, data: { whiteDelta: d.white, blackDelta: d.black, updatedAt: now } })
    }
    return tx.chessGame.findUniqueOrThrow({ where: { id: g.id } })
  })
  if (next && finishing && next.result) await reportActivity(next, now)
  return next
}

async function reportActivity(g: ChessGame, now: Date) {
  const res = g.result as GameResult
  for (const [id, side] of [[g.whiteId, 'w'], [g.blackId, 'b']] as const) {
    if (!id) continue
    const won = (res === '1-0' && side === 'w') || (res === '0-1' && side === 'b')
    const result = res === '1/2-1/2' ? 'draw' : won ? 'win' : 'loss'
    // ponytail: пояс — тот, что пользователь уже сообщил (бот/задачи); без него Москва. Клиентский tz в каждый ход не шлём.
    const tz = (await prisma.chessProfile.findUnique({ where: { userId: id }, select: { tzOffsetMin: true } }))?.tzOffsetMin ?? -180
    await recordChessActivity(id, { kind: 'online', tzOffsetMin: tz, result }, now).catch((e) => console.error('[chess online activity]', e))
  }
}

/** Флаг по времени / несделанный первый ход, найденные при чтении, — сохранить. */
export async function settled(g: ChessGame, now = new Date()): Promise<ChessGame> {
  const patch = settle(asCore(g), now)
  if (!patch) return g
  return (await commit(g, patch, now)) ?? (await prisma.chessGame.findUniqueOrThrow({ where: { id: g.id } }))
}

async function player(id: string | null, rating: number | null): Promise<OnlinePlayer | null> {
  if (!id) return null
  const p = await findChessPlayer(id)
  return p ? { id, name: p.name, avatarUrl: p.avatarUrl, rating: rating ?? (await ratingOf(id)) } : null
}

export async function toState(g: ChessGame, userId: string, since: number | null, now = new Date()): Promise<OnlineGameState> {
  const list = moveList(g)
  const from = since !== null && since >= 0 && since <= list.length ? since : 0
  const done = g.status === 'finished' || g.status === 'aborted'
  const state: OnlineGameState = {
    id: g.id,
    status: g.status as OnlineGame['status'],
    result: g.result as GameResult | null,
    termination: g.termination,
    timeControl: g.timeControl,
    rated: g.rated,
    initialFen: g.initialFen,
    ply: list.length,
    since: from,
    moves: list.slice(from),
    turn: sideToMove(g),
    ...clocksAt(asCore(g), now),
    serverNow: now.getTime(),
    drawOfferBy: g.drawOfferBy as Side | null,
    you: sideOf(g, userId),
    whiteDelta: g.whiteDelta,
    blackDelta: g.blackDelta,
    rematchId: done ? ((await prisma.chessGame.findUnique({ where: { rematchOf: g.id }, select: { id: true } }))?.id ?? null) : null,
    canJoin: g.status === 'waiting' && !sideOf(g, userId) && (!g.invitedId || g.invitedId === userId),
  }
  if (since !== null) return state
  const [white, black, invited] = await Promise.all([player(g.whiteId, g.whiteRating), player(g.blackId, g.blackRating), player(g.invitedId, null)])
  return { ...state, white, black, invited }
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Занять свободное место: ссылка «играть с другом» — первый вошедший не-создатель, вызов/реванш — только приглашённый. */
export async function joinGame(user: User, g: ChessGame) {
  if (sideOf(g, user.id)) return NextResponse.json(await toState(g, user.id, null))
  if (g.status !== 'waiting') return conflict('TAKEN', g.id, user.id)
  if (g.invitedId && g.invitedId !== user.id) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const creator = (g.whiteId ?? g.blackId)!
  const [mine, theirs] = await Promise.all([ratingOf(user.id), ratingOf(creator)])
  const now = new Date()
  const patch = g.whiteId
    ? { blackId: user.id, whiteRating: theirs, blackRating: mine }
    : { whiteId: user.id, whiteRating: mine, blackRating: theirs }
  const next = await commit(g, { ...patch, status: 'active', turnStartedAt: now }, now)
  return next ? NextResponse.json(await toState(next, user.id, null)) : conflict('TAKEN', g.id, user.id)
}

export type GameListItem = {
  id: string
  status: string
  timeControl: string
  result: string | null
  termination: string | null
  you: Side | null
  opponent: { id: string; name: string } | null
  delta: number | null
  updatedAt: string
}

export async function toListItems(games: ChessGame[], userId: string): Promise<GameListItem[]> {
  const ids = [...new Set(games.flatMap((g) => [g.whiteId, g.blackId, g.invitedId]).filter((x): x is string => !!x && x !== userId))]
  const by = { where: { id: { in: ids } }, select: { id: true, name: true } } as const
  const [teachers, students] = ids.length ? await Promise.all([prisma.teacher.findMany(by), prisma.student.findMany(by)]) : [[], []]
  const names = new Map([...students, ...teachers].map((p) => [p.id, p.name]))
  return games.map((g) => {
    const you = sideOf(g, userId)
    const oppId = (you === 'w' ? g.blackId : you === 'b' ? g.whiteId : g.whiteId ?? g.blackId) ?? g.invitedId
    return {
      id: g.id,
      status: g.status,
      timeControl: g.timeControl,
      result: g.result,
      termination: g.termination,
      you,
      opponent: oppId && oppId !== userId ? { id: oppId, name: names.get(oppId) ?? '—' } : null,
      delta: you === 'w' ? g.whiteDelta : you === 'b' ? g.blackDelta : null,
      updatedAt: g.updatedAt.toISOString(),
    }
  })
}

const SEEK_LOCK = 7212012 // одна блокировка на подбор и отмену: отмена не рвёт подбор посреди транзакции
const SEEK_ALIVE_MS = 10_000 // клиент опрашивает раз в ~2 с; молчащий дольше — ушёл

/**
 * Быстрый подбор (он же опрос ждущего): под транзакционной блокировкой — два одновременных seek дают ровно одну партию.
 * → {gameId} (найдена — своя или созданная соперником) | {waiting:true, window}
 */
export async function seekMatch(userId: string, timeControl: string): Promise<{ gameId: string } | { waiting: true; window: number }> {
  const tc = parseTimeControl(timeControl)!
  const rating = await ratingOf(userId)
  return prisma.$transaction(async (tx) => {
    // ponytail: одна глобальная блокировка на весь подбор; хватит до сотен ждущих, дальше — блокировка по контролю времени
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SEEK_LOCK})::text`
    const now = new Date()
    const mine = await tx.chessSeek.findUnique({ where: { userId } })
    if (mine?.gameId) {
      await tx.chessSeek.delete({ where: { userId } })
      return { gameId: mine.gameId }
    }
    const fresh = !mine || mine.timeControl !== timeControl
    const me = await tx.chessSeek.upsert({
      where: { userId },
      create: { userId, timeControl, rating },
      update: { rating, seenAt: now, ...(fresh ? { timeControl, createdAt: now } : {}) },
    })
    const others = await tx.chessSeek.findMany({
      where: { timeControl, gameId: null, seenAt: { gt: new Date(now.getTime() - SEEK_ALIVE_MS) }, userId: { not: userId } },
    })
    const opp = pickOpponent(me, others, now)
    if (!opp) return { waiting: true as const, window: seekWindow(now.getTime() - me.createdAt.getTime()) }
    const oppRating = others.find((s) => s.userId === opp)!.rating
    const meWhite = Math.random() < 0.5
    const g = await tx.chessGame.create({
      data: {
        whiteId: meWhite ? userId : opp,
        blackId: meWhite ? opp : userId,
        whiteRating: meWhite ? rating : oppRating,
        blackRating: meWhite ? oppRating : rating,
        initialFen: START_FEN,
        timeControl,
        whiteMs: tc.baseMs,
        blackMs: tc.baseMs,
        status: 'active',
        turnStartedAt: now,
      },
    })
    await tx.chessSeek.delete({ where: { userId } })
    await tx.chessSeek.update({ where: { userId: opp }, data: { gameId: g.id } })
    return { gameId: g.id }
    })
}

/** Отмена ожидания под той же блокировкой → gameId, если соперник успел найтись. */
export async function cancelSeek(userId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SEEK_LOCK})::text`
    const mine = await tx.chessSeek.findUnique({ where: { userId } })
    await tx.chessSeek.deleteMany({ where: { userId } })
    return mine?.gameId ?? null
  })
}
