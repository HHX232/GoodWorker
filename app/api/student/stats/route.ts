import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function buildWeeks(n = 12) {
  const now = new Date()
  const weeks: { weekStart: Date; label: string; count: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const ws = startOfWeek(d)
    weeks.push({ weekStart: ws, label: weekLabel(ws), count: 0 })
  }
  return weeks
}

function fillWeeks(
  weeks: { weekStart: Date; label: string; count: number }[],
  dates: Date[],
) {
  for (const date of dates) {
    const ws = startOfWeek(date)
    const wsTime = ws.getTime()
    const bucket = weeks.find(w => w.weekStart.getTime() === wsTime)
    if (bucket) bucket.count++
  }
  return weeks.map(w => ({ week: w.label, count: w.count }))
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const studentId = session.user.id

    const [errors, attempts, postViews, roadmapProgress, calls] = await Promise.all([
      prisma.studentError.findMany({
        where: { studentId },
        orderBy: { createdAt: 'asc' },
        include: {
          categories: {
            include: {
              category: { include: { translations: { where: { langCode: 'ru' } } } },
            },
          },
        },
      }),
      prisma.studentTestAttempt.findMany({
        where: { studentId },
        orderBy: { startedAt: 'asc' },
        select: { id: true, percent: true, startedAt: true, finishedAt: true },
      }),
      prisma.postView.findMany({
        where: { studentId },
        orderBy: { viewedAt: 'asc' },
        select: { viewedAt: true },
      }),
      prisma.studentRoadmapProgress.findMany({
        where: { studentId },
        orderBy: { startedAt: 'asc' },
        select: { startedAt: true, completedAt: true },
      }),
      prisma.conferenceParticipant.findMany({
        where: { studentId, role: 'STUDENT' },
        orderBy: { joinedAt: 'asc' },
        select: { joinedAt: true },
      }),
    ])

    const totalCorrected = errors.filter(e => e.isCorrection).length
    const actualErrors = errors.filter(e => !e.isCorrection)

    // ── Error categories ─────────────────────────────────────
    const ERROR_COLORS = [
      '#6366F1', '#EC4899', '#F59E0B', '#10B981',
      '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6',
      '#F97316', '#84CC16',
    ]
    const catMap: Record<string, { name: string; count: number }> = {}
    for (const err of actualErrors) {
      for (const c of err.categories) {
        const name = c.category.translations[0]?.name ?? c.category.slug
        if (!catMap[c.categoryId]) catMap[c.categoryId] = { name, count: 0 }
        catMap[c.categoryId].count++
      }
    }
    const errorsByCategory = Object.entries(catMap)
      .map(([id, v], i) => ({ id, name: v.name, count: v.count, color: ERROR_COLORS[i % ERROR_COLORS.length] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── Errors over time ─────────────────────────────────────
    const errorsOverTime = fillWeeks(buildWeeks(), actualErrors.map(e => new Date(e.createdAt)))

    // ── Test scores over time (weekly avg) ───────────────────
    const scoreWeeks = buildWeeks()
    for (const att of attempts) {
      if (att.percent == null) continue
      const ws = startOfWeek(new Date(att.startedAt))
      const wsTime = ws.getTime()
      const bucket = scoreWeeks.find(w => w.weekStart.getTime() === wsTime)
      if (bucket) bucket.count += att.percent
    }
    const attemptCountWeeks = buildWeeks()
    for (const att of attempts) {
      const ws = startOfWeek(new Date(att.startedAt))
      const wsTime = ws.getTime()
      const b = attemptCountWeeks.find(w => w.weekStart.getTime() === wsTime)
      if (b) b.count++
    }
    const attemptsOverTime = scoreWeeks.map((w, i) => ({
      week: w.label,
      avgScore: attemptCountWeeks[i].count > 0
        ? Math.round(w.count / attemptCountWeeks[i].count)
        : null,
      count: attemptCountWeeks[i].count,
    }))

    // ── Posts read over time ─────────────────────────────────
    const postsOverTime = fillWeeks(buildWeeks(), postViews.map(v => new Date(v.viewedAt)))

    // ── Roadmaps started over time ───────────────────────────
    const roadmapsOverTime = fillWeeks(buildWeeks(), roadmapProgress.map(r => new Date(r.startedAt)))

    // ── Video lessons over time ──────────────────────────────
    const callsOverTime = fillWeeks(
      buildWeeks(),
      calls.filter(c => c.joinedAt).map(c => new Date(c.joinedAt!)),
    )

    // ── Totals ───────────────────────────────────────────────
    const validAttempts = attempts.filter(a => a.percent != null)
    const avgScore = validAttempts.length > 0
      ? Math.round(validAttempts.reduce((s, a) => s + (a.percent ?? 0), 0) / validAttempts.length)
      : null

    return NextResponse.json({
      totalErrors: actualErrors.length,
      totalCorrected,
      totalAttempts: attempts.length,
      totalPostViews: postViews.length,
      totalRoadmaps: roadmapProgress.length,
      totalCalls: calls.length,
      avgScore,
      errorsByCategory,
      errorsOverTime,
      attemptsOverTime,
      postsOverTime,
      roadmapsOverTime,
      callsOverTime,
    })
  } catch (e) {
    console.error('[GET /api/student/stats]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
