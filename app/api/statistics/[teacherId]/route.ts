import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const SUBJECT_COLORS = [
  '#1a1a1a', '#3d3d3d', '#606060', '#888888', '#aaaaaa',
  '#c4c4c4', '#d8d8d8', '#4a6fa5', '#6b8e5e', '#8b6fa5',
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
      select: { id: true, name: true, avatarUrl: true },
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

    // Compute per-call durations (hours)
    const callsWithDuration = calls.map((c) => {
      const ms = c.endedAt!.getTime() - c.createdAt.getTime()
      return { ...c, durationHours: Math.max(0, ms / (1000 * 60 * 60)) }
    })

    const totalCalls = calls.length
    const totalHours = callsWithDuration.reduce((s, c) => s + c.durationHours, 0)

    // ── Monthly chart data (last 6 months) ──────────────────────────────────
    const now = new Date()
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

    return NextResponse.json({
      teacher,
      totalCalls,
      totalHours: +totalHours.toFixed(1),
      studentCount,
      roadmapCount,
      monthsData,
      subjectData,
      recentCalls,
      calendarLessons,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
