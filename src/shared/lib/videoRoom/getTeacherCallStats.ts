import { prisma } from '@/shared/prisma/prisma'

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
  const endedCalls = await prisma.videoCallRoom.findMany({
    where: { ownerId: teacherId, endedAt: { not: null } },
    select: { createdAt: true, endedAt: true },
  })

  const totalHours = endedCalls.reduce(
    (sum, c) => sum + Math.max(0, (c.endedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60)),
    0
  )

  return { totalCalls: endedCalls.length, totalHours: Number(totalHours.toFixed(1)) }
}
