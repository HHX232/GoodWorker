import { prisma } from '@/shared/prisma/prisma'
import type { LectureSettings } from '@prisma/client'

// The ONE place /lecture would touch a Wallet (same pattern as
// tutorFiles/billing.ts). This build has no Wallet: the price is computed
// and shown, nothing is charged; `maxMinutesPerDay` is the safety cap.
export const LECTURE_BILLING_ENABLED = false

export const LECTURE_SETTINGS_DEFAULTS = {
  baseMinutes: 30,
  basePer5MinKopecks: 500,
  extraPer5MinKopecks: 200,
  aiMarkup: 3,
  aiInputPer1MKopecks: 2600,
  aiOutputPer1MKopecks: 10000,
  maxMinutesPerDay: 240,
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
