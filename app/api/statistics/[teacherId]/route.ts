import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const SUBJECT_COLORS = [
  '#818cf8', '#a78bfa', '#6366f1', '#c4b5fd', '#7c3aed',
  '#8b5cf6', '#4f46e5', '#a5b4fc', '#d8b4fe', '#5b21b6',
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { teacherId } = await params
    const { role, id: userId } = session.user as { role: string; id: string }

    // Only the teacher themselves or admins can view stats
    if (role !== 'ADMIN' && !(role === 'TEACHER' && userId === teacherId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, avatarUrl: true, calendar: true },
    })
    if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

    // All completed calls owned by this teacher
    const calls = await prisma.videoCallRoom.findMany({
      where: { ownerId: teacherId, ownerRole: 'TEACHER', endedAt: { not: null } },
      include: {
        participants: { select: { userId: true, userRole: true, identity: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Aggregated counts
    const studentCount = await prisma.teacherStudent.count({ where: { teacherId } })
    const roadmapCount = await prisma.roadmap.count({ where: { teacherId } })

    // ── Hero bar stats ───────────────────────────────────────────────────────
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [newStudentsThisMonth, newStudentsPrevMonth] = await Promise.all([
      prisma.teacherStudent.count({ where: { teacherId, linkedAt: { gte: startOfMonth } } }),
      prisma.teacherStudent.count({ where: { teacherId, linkedAt: { gte: startOfPrevMonth, lt: startOfMonth } } }),
    ])

    const teacherRoadmapIds = await prisma.roadmap
      .findMany({ where: { teacherId }, select: { id: true } })
      .then((rs) => rs.map((r) => r.id))

    const [completedProgressRaw, activeProgressCount] = teacherRoadmapIds.length > 0
      ? await Promise.all([
          prisma.studentRoadmapProgress.findMany({
            where: { roadmapId: { in: teacherRoadmapIds }, completedAt: { not: null } },
            select: { studentId: true },
            distinct: ['studentId'],
          }),
          prisma.studentRoadmapProgress.count({
            where: { roadmapId: { in: teacherRoadmapIds }, completedAt: null },
          }),
        ])
      : [[], 0]

    const completedStudentsCount = completedProgressRaw.length
    const total = Math.max(studentCount, 1)
    const totalProgress = Math.max(completedStudentsCount + activeProgressCount, 1)

    const heroStats = {
      newStudentsThisMonth,
      newStudentsPrevMonth,
      completedStudentsCount,
      activeProgressCount,
      totalStudents: studentCount,
      totalProgress,
    }

    // Compute per-call durations (hours)
    const callsWithDuration = calls.map((c) => {
      const ms = c.endedAt!.getTime() - c.createdAt.getTime()
      return { ...c, durationHours: Math.max(0, ms / (1000 * 60 * 60)) }
    })

    const totalCalls = calls.length
    const totalHours = callsWithDuration.reduce((s, c) => s + c.durationHours, 0)

    // ── Monthly chart data (last 6 months) ──────────────────────────────────
    const monthsData: Record<string, { day: string; hours: number }[]> = {}

    // Build 6-month window
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      monthsData[key] = Array.from({ length: daysInMonth }, (_, idx) => ({
        day: String(idx + 1),
        hours: 0,
      }))
    }

    // Fill in actual call hours
    for (const call of callsWithDuration) {
      const d = call.createdAt
      const key = `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}`
      if (!monthsData[key]) continue
      const dayIdx = d.getDate() - 1
      monthsData[key][dayIdx].hours = +(
        (monthsData[key][dayIdx].hours + call.durationHours)
      ).toFixed(2)
    }

    // ── Subject/topic breakdown ──────────────────────────────────────────────
    const subjectMap: Record<string, { hours: number; count: number }> = {}

    for (const call of callsWithDuration) {
      const topic = call.topic?.trim() || 'Без темы'
      if (!subjectMap[topic]) subjectMap[topic] = { hours: 0, count: 0 }
      subjectMap[topic].hours += call.durationHours
      subjectMap[topic].count += 1
    }

    const subjectData = Object.entries(subjectMap)
      .map(([name, { hours, count }], i) => ({
        name,
        hours: +hours.toFixed(2),
        count,
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.hours - a.hours)

    // ── Recent calls ────────────────────────────────────────────────────────
    const recentCalls = callsWithDuration.slice(0, 40).map((c) => ({
      id: c.id,
      name: c.name,
      topic: c.topic ?? null,
      createdAt: c.createdAt.toISOString(),
      endedAt: c.endedAt!.toISOString(),
      durationHours: +c.durationHours.toFixed(2),
      participantCount: c.participants.length,
    }))

    // ── Calendar lessons (last 8 weeks, with student names) ─────────────────
    const allStudentIds = [
      ...new Set(
        calls.flatMap((c) =>
          c.participants.filter((p) => p.userRole === 'STUDENT' && p.userId).map((p) => p.userId!)
        )
      ),
    ]
    const studentsInfo =
      allStudentIds.length > 0
        ? await prisma.student.findMany({
            where: { id: { in: allStudentIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : []
    const studentInfoMap: Record<string, { name: string; avatarUrl: string | null }> = {}
    studentsInfo.forEach((s) => { studentInfoMap[s.id] = { name: s.name, avatarUrl: s.avatarUrl } })

    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)
    const calendarLessons = callsWithDuration
      .filter((c) => c.createdAt >= eightWeeksAgo)
      .map((c) => {
        const sp = c.participants.find((p) => p.userRole === 'STUDENT')
        const info = sp?.userId ? studentInfoMap[sp.userId] : null
        return {
          id: c.id,
          studentName: info?.name ?? sp?.identity ?? c.name,
          studentAvatar: info?.avatarUrl ?? null,
          subject: c.topic?.trim() || 'Без темы',
          time: `${String(c.createdAt.getHours()).padStart(2, '0')}:${String(c.createdAt.getMinutes()).padStart(2, '0')}`,
          duration: Math.max(1, Math.round(c.durationHours * 60)),
          date: c.createdAt.toISOString(),
        }
      })

    // ── Calendar events from teacher's calendar JSON ─────────────────────────
    const calendarJson = teacher.calendar as { events?: unknown[] } | null
    const calendarEvents = Array.isArray(calendarJson?.events) ? calendarJson!.events : []

    // ── AI-detected error stats per category ─────────────────────────────────
    const teacherStudentIds = await prisma.teacherStudent.findMany({
      where: { teacherId },
      select: { studentId: true },
    })
    const myStudentIds = teacherStudentIds.map((ts) => ts.studentId)

    const ERROR_COLORS = [
      '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D',
      '#059669', '#0891B2', '#2563EB', '#7C3AED', '#C026D3',
    ]

    const CORRECTION_COLORS = [
      '#16a34a', '#0891B2', '#059669', '#0d9488', '#65A30D',
      '#7C3AED', '#2563EB', '#CA8A04', '#EA580C', '#C026D3',
    ]

    let errorStats: { categoryId: string; name: string; count: number; color: string }[] = []
    let correctionStats: { categoryId: string; name: string; count: number; color: string }[] = []

    if (myStudentIds.length > 0) {
      const [rawErrCats, rawCorrCats] = await Promise.all([
        prisma.studentErrorCategory.findMany({
          where: { error: { studentId: { in: myStudentIds }, sourceType: 'video_call', isCorrection: false } },
          include: { category: { include: { translations: { where: { langCode: 'ru' } } } } },
        }),
        prisma.studentErrorCategory.findMany({
          where: { error: { studentId: { in: myStudentIds }, sourceType: 'video_call', isCorrection: true } },
          include: { category: { include: { translations: { where: { langCode: 'ru' } } } } },
        }),
      ])

      const buildStats = (
        rows: typeof rawErrCats,
        colors: string[],
      ) => {
        const catMap: Record<string, { name: string; count: number }> = {}
        for (const sec of rows) {
          const name = sec.category.translations[0]?.name ?? sec.category.slug
          if (!catMap[sec.categoryId]) catMap[sec.categoryId] = { name, count: 0 }
          catMap[sec.categoryId].count++
        }
        return Object.entries(catMap)
          .map(([categoryId, { name, count }], i) => ({
            categoryId, name, count, color: colors[i % colors.length],
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      }

      errorStats = buildStats(rawErrCats, ERROR_COLORS)
      correctionStats = buildStats(rawCorrCats, CORRECTION_COLORS)
    }

    return NextResponse.json({
      teacher: { id: teacher.id, name: teacher.name, avatarUrl: teacher.avatarUrl },
      totalCalls,
      totalHours: +totalHours.toFixed(1),
      studentCount,
      roadmapCount,
      monthsData,
      subjectData,
      recentCalls,
      calendarLessons,
      calendarEvents,
      heroStats,
      errorStats,
      correctionStats,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
