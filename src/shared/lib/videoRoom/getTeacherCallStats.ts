import { prisma } from '@/shared/prisma/prisma'

// A lesson longer than this is clearly bad data, not a real class — clamp
// each room's contribution instead of letting one row skew the total.
// Exported so other call-duration aggregations (e.g. the statistics route's
// per-day/per-subject breakdowns) clamp against the same threshold.
export const MAX_HOURS_PER_CALL = 4

// Single source of truth for "how many lessons / hours has this teacher
// taught" — only counts calls that were actually marked ended, same filter
// the /statistics page uses. Duplicating this ad-hoc per call site is what
// caused the profile widgets to show callCount (all rooms ever created,
// ended or not) in place of real hours.
export async function getTeacherCallStats(teacherId: string): Promise<{ totalCalls: number; totalHours: number }> {
  // No ownerRole filter: an admin account backed by a teacher record
  // creates rooms with ownerRole 'ADMIN', not 'TEACHER' — ownerId already
  // scopes this to the right teacher, so filtering on role would drop
  // those calls (see /api/statistics/[teacherId]/route.ts for the same fix).
  //
  // `participants: { some: {} }` is the real filter here: VideoCallParticipant
  // rows are only ever written by /api/call/transcript at hangup time, so a
  // room with none was never actually joined — just created and later
  // reaped by the close-stale-rooms cron, sometimes days afterward. Without
  // this, createdAt→endedAt on those abandoned rooms produced absurd totals
  // (e.g. "1409 hours" off 10 real lessons).
  const endedCalls = await prisma.videoCallRoom.findMany({
    where: { ownerId: teacherId, endedAt: { not: null }, participants: { some: {} } },
    select: { createdAt: true, endedAt: true },
  })

  const totalHours = endedCalls.reduce((sum, c) => {
    const hours = (c.endedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60)
    return sum + Math.min(Math.max(0, hours), MAX_HOURS_PER_CALL)
  }, 0)

  return { totalCalls: endedCalls.length, totalHours: Number(totalHours.toFixed(1)) }
}
