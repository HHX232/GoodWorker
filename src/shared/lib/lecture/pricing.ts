import { prisma } from '@/shared/prisma/prisma'
import type { LectureNote, LectureSettings } from '@prisma/client'
import type { AIUsage } from '@/lib/openrouter'
import { isStorageAdmin } from '@/shared/lib/tutorFiles/storage'
import { computeCostCents } from '@/shared/lib/wallet/pricing'
import { debitBalance, getBalanceCents, InsufficientBalanceError, type WalletUser } from '@/shared/lib/wallet/wallet'

// The ONE place /lecture touches the Wallet (same pattern as
// tutorFiles/billing.ts). Wallet build: the owner pays from their balance —
// `pricePerMinuteCents` per started minute of recording (charged as chunks
// arrive) and DeepSeek's own cost of every lecture AI call + `aiMarkupPercent`.
// Admins (AdminEmail) aren't charged. `maxMinutesPerDay` stays a safety cap.
export const LECTURE_BILLING_ENABLED = true

export const LECTURE_SETTINGS_DEFAULTS = {
  baseMinutes: 30,
  basePer5MinKopecks: 500,
  extraPer5MinKopecks: 200,
  aiMarkup: 3,
  aiInputPer1MKopecks: 2600,
  aiOutputPer1MKopecks: 10000,
  maxMinutesPerDay: 240,
  pricePerMinuteCents: 1,
  aiMarkupPercent: 200,
} as const

export type LectureTariff = Omit<LectureSettings, 'id' | 'updatedAt'>

export async function getLectureSettings(): Promise<LectureTariff> {
  const row = await prisma.lectureSettings.findUnique({ where: { id: 'global' } })
  if (!row) return { ...LECTURE_SETTINGS_DEFAULTS }
  const { id, updatedAt, ...rest } = row
  void id; void updatedAt
  return rest
}

/**
 * Tariff (decided with the owner): the first `baseMinutes` cost
 * `basePer5MinKopecks` per started 5 minutes; after that every started 5
 * minutes costs `extraPer5MinKopecks`, plus DeepSeek's own cost of the
 * tokens spent past the base part × `aiMarkup`. Tokens are split between the
 * two parts in proportion to time.
 */
export function lectureCostKopecks(t: LectureTariff, recordedMs: number, promptTokens: number, completionTokens: number): number {
  const minutes = recordedMs / 60_000
  if (minutes <= 0) return 0
  const baseMin = Math.min(minutes, t.baseMinutes)
  const extraMin = Math.max(0, minutes - t.baseMinutes)
  const blocks = (m: number) => Math.ceil(m / 5)
  const aiCost = (promptTokens * t.aiInputPer1MKopecks + completionTokens * t.aiOutputPer1MKopecks) / 1_000_000
  const extraShare = extraMin / minutes
  return Math.round(blocks(baseMin) * t.basePer5MinKopecks + blocks(extraMin) * t.extraPer5MinKopecks + aiCost * extraShare * t.aiMarkup)
}

/** Minutes this owner already recorded today (server day), across lectures. */
export async function minutesRecordedToday(ownerId: string, ownerRole: 'STUDENT' | 'TEACHER'): Promise<number> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const rows = await prisma.lectureChunk.aggregate({
    where: { createdAt: { gte: start }, lecture: { ownerId, ownerRole } },
    _sum: { durationMs: true },
  })
  return (rows._sum.durationMs ?? 0) / 60_000
}

// ─── Wallet ─────────────────────────────────────────────────────────────

type Owner = Pick<LectureNote, 'ownerId' | 'ownerRole'>

/** Who pays for a lecture: its owner — null for admins, who use /lecture for free. */
async function payer(lecture: Owner): Promise<WalletUser | null> {
  const role = lecture.ownerRole === 'STUDENT' ? 'STUDENT' : 'TEACHER'
  if (role === 'TEACHER' && (await isStorageAdmin(lecture.ownerId))) return null
  return { id: lecture.ownerId, role }
}

/**
 * Before recording a chunk / calling the AI: the balance must cover at least
 * `needCents` (one minute of recording, or a cent for an AI call — its real
 * cost is only known afterwards; the debit is zero-floor). Throws
 * InsufficientBalanceError → the route answers 402 (insufficientBalanceResponse).
 */
export async function assertLectureBalance(lecture: Owner, needCents: number): Promise<void> {
  const user = await payer(lecture)
  if (!user || needCents <= 0) return
  const balance = await getBalanceCents(user)
  if (balance < needCents) throw new InsufficientBalanceError(needCents - balance, balance)
}

/** One minute's price, rounded up to a whole cent — what a chunk needs on the balance. */
export async function minuteNeedCents(): Promise<number> {
  const t = await getLectureSettings()
  return t.pricePerMinuteCents > 0 ? Math.ceil(t.pricePerMinuteCents) : 0
}

/**
 * Charges the minutes recorded since the last charge (per started minute).
 * The minutes are claimed first with a conditional update, so two chunks
 * landing together never charge the same minute twice.
 */
export async function chargeLectureMinutes(lectureId: string): Promise<void> {
  const lecture = await prisma.lectureNote.findUnique({ where: { id: lectureId }, select: { ownerId: true, ownerRole: true, title: true, recordedMs: true, chargedMinutes: true } })
  if (!lecture) return
  const minutes = Math.ceil(lecture.recordedMs / 60_000)
  if (minutes <= lecture.chargedMinutes) return
  const user = await payer(lecture)
  const claimed = await prisma.lectureNote.updateMany({ where: { id: lectureId, chargedMinutes: lecture.chargedMinutes }, data: { chargedMinutes: minutes } })
  if (!claimed.count || !user) return
  const { pricePerMinuteCents: price } = await getLectureSettings()
  const cost = Math.round(minutes * price) - Math.round(lecture.chargedMinutes * price)
  const res = await debitBalance(user, cost, {
    type: 'LECTURE_DEBIT',
    endpoint: 'lecture/minutes',
    description: `Конспект «${lecture.title || 'Лекция'}»: ${minutes - lecture.chargedMinutes} мин записи`,
  })
  if (res.costCents > 0) await prisma.lectureNote.update({ where: { id: lectureId }, data: { chargedCents: { increment: res.costCents } } })
}

/** Charges one lecture AI call: DeepSeek's cost of its tokens + the lecture markup. After a successful call only. */
export async function chargeLectureAI(lectureId: string, usage: AIUsage): Promise<void> {
  const lecture = await prisma.lectureNote.findUnique({ where: { id: lectureId }, select: { ownerId: true, ownerRole: true, title: true } })
  if (!lecture) return
  const user = await payer(lecture)
  if (!user) return
  const { aiMarkupPercent } = await getLectureSettings()
  const now = new Date()
  const res = await debitBalance(user, computeCostCents(usage, now, aiMarkupPercent), {
    type: 'LECTURE_DEBIT',
    endpoint: 'lecture/ai',
    description: `Конспект «${lecture.title || 'Лекция'}»: ИИ`,
    rawCostCents: computeCostCents(usage, now, 0),
    totalTokens: usage.promptCacheHitTokens + usage.promptCacheMissTokens + usage.completionTokens,
  })
  if (res.costCents > 0) await prisma.lectureNote.update({ where: { id: lectureId }, data: { chargedCents: { increment: res.costCents } } })
}
