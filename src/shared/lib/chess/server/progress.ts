import { prisma } from '@/shared/prisma/prisma'
import { GUEST_PUZZLE_RATING } from './puzzleRating'
import { applyActivity, localDay, streakState, vipDaysFor, vipExpiryAfterReward, type ActivityInput } from './progressModel'

export * from './progressModel'

export type ChessBadgeDto = { code: string; earnedAt: string }
export type ChessProgressDto = {
  rating: number
  ratingGames: number
  puzzleRating: number
  puzzlesSolved: number
  botPoints: number
  streakCurrent: number
  streakBest: number
  lastActiveDay: string | null // только в /me — день в поясе самого пользователя
  stormBest3: number
  stormBest5: number
  badges: ChessBadgeDto[]
}
export type ChessPlayerDto = { id: string; name: string; avatarUrl: string | null; isTeacher: boolean }

type Row = Awaited<ReturnType<typeof prisma.chessProfile.findUnique>>

function toDto(p: Row, badges: { code: string; earnedAt: Date }[]): ChessProgressDto {
  return {
    rating: p?.rating ?? 1200,
    ratingGames: p?.ratingGames ?? 0,
    puzzleRating: p?.puzzleRating ?? GUEST_PUZZLE_RATING,
    puzzlesSolved: p?.solved ?? 0,
    botPoints: p?.botPoints ?? 0,
    streakCurrent: p?.streakCurrent ?? 0,
    streakBest: p?.streakBest ?? 0,
    lastActiveDay: p?.lastActiveDay ?? null,
    stormBest3: p?.stormBest3 ?? 0,
    stormBest5: p?.stormBest5 ?? 0,
    badges: badges.map((b) => ({ code: b.code, earnedAt: b.earnedAt.toISOString() })),
  }
}

export async function loadChessProgress(userId: string): Promise<ChessProgressDto> {
  const [p, badges] = await Promise.all([
    prisma.chessProfile.findUnique({ where: { userId } }),
    prisma.chessBadge.findMany({ where: { userId }, select: { code: true, earnedAt: true }, orderBy: { earnedAt: 'asc' } }),
  ])
  return toDto(p, badges)
}

/** Публичный вид: без дня последней активности; серия, прерванная во всех поясах, показывается нулём. */
export function toPublicProgress(p: ChessProgressDto, now = new Date()): ChessProgressDto {
  const westmostToday = localDay(now, 720) // UTC−12: самый «ранний» календарный день на Земле
  const alive = streakState(p.lastActiveDay, westmostToday) !== 'broken'
  return { ...p, streakCurrent: alive ? p.streakCurrent : 0, lastActiveDay: null }
}

export async function findChessPlayer(id: string): Promise<ChessPlayerDto | null> {
  const t = await prisma.teacher.findUnique({ where: { id }, select: { id: true, name: true, avatarUrl: true } })
  if (t) return { ...t, isTeacher: true }
  const s = await prisma.student.findUnique({ where: { id }, select: { id: true, name: true, avatarUrl: true } })
  return s ? { ...s, isTeacher: false } : null
}

/**
 * Единая точка прогресса: серия, очки за ботов, значки, дни VIP за значки (G12–G13.1).
 * Онлайн (T12) и шторм (T13) зовут её на сервере; бот и решебник — через POST /api/chess/activity.
 */
export async function recordChessActivity(userId: string, input: ActivityInput, now = new Date()) {
  const result = await prisma.$transaction(async (tx) => {
    // ON CONFLICT вместо upsert: первая активность нового пользователя в двух вкладках сразу не падает P2002
    await tx.$executeRaw`INSERT INTO "ChessProfile" ("userId", "updatedAt") VALUES (${userId}, NOW()) ON CONFLICT ("userId") DO NOTHING`
    await tx.$queryRaw`SELECT 1 FROM "ChessProfile" WHERE "userId" = ${userId} FOR UPDATE` // параллельные партии не теряют очки
    const cur = await tx.chessProfile.findUniqueOrThrow({ where: { userId } })
    const owned = (await tx.chessBadge.findMany({ where: { userId }, select: { code: true } })).map((b) => b.code)
    const state = {
      botPoints: cur.botPoints,
      streakCurrent: cur.streakCurrent,
      streakBest: cur.streakBest,
      lastActiveDay: cur.lastActiveDay,
      tzOffsetMin: cur.tzOffsetMin,
      tzSetAt: cur.tzSetAt?.toISOString() ?? null,
      pointsDay: cur.pointsDay,
      pointsToday: cur.pointsToday,
    }
    const r = applyActivity(state, owned, input, now)
    if (!r.counted) return { newBadges: [] as string[], streakChanged: false }

    await tx.chessProfile.update({ where: { userId }, data: { ...r.next, tzSetAt: r.next.tzSetAt ? new Date(r.next.tzSetAt) : null } })
    // уникальность (userId, code) — значок и его VIP выдаются один раз даже при гонке
    const created = r.newBadges.length
      ? (await tx.chessBadge.createManyAndReturn({ data: r.newBadges.map((code) => ({ userId, code })), skipDuplicates: true, select: { code: true } })).map((b) => b.code)
      : []
    const days = vipDaysFor(created)
    if (days > 0) await grantVipDays(tx, userId, days, created, now)
    return { newBadges: created, streakChanged: r.streakChanged }
  })
  return { profile: await loadChessProgress(userId), ...result }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Путь applyPromoCode (isVip + vipExpiresAt + VipTransaction), но свой тип CHESS_BADGE — запись отличима от промокода.
// Бессрочный VIP срок не получает (vipExpiryAfterReward → null): пишем только транзакцию.
async function grantVipDays(tx: Tx, userId: string, days: number, codes: string[], now: Date) {
  const description = `chess-badge:${codes.join(',')} +${days} дн. VIP`
  const select = { isVip: true, vipExpiresAt: true } as const
  const teacher = await tx.teacher.findUnique({ where: { id: userId }, select })
  const student = teacher ? null : await tx.student.findUnique({ where: { id: userId }, select })
  const cur = teacher ?? student
  if (!cur) return
  const until = vipExpiryAfterReward(cur, days, now)
  const data = until ? { isVip: true, vipExpiresAt: until } : { isVip: true }
  if (teacher) await tx.teacher.update({ where: { id: userId }, data })
  else await tx.student.update({ where: { id: userId }, data })
  await tx.vipTransaction.create({
    data: {
      ...(teacher ? { teacherId: userId, userRole: 'TEACHER' as const } : { studentId: userId, userRole: 'STUDENT' as const }),
      type: 'CHESS_BADGE',
      amount: 0,
      description,
      vipGrantedUntil: until ?? cur.vipExpiresAt,
    },
  })
}
