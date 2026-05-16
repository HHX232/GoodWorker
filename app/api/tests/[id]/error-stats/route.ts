import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

// GET /api/tests/[id]/error-stats
// Returns per-category frequency + per-student error breakdown for a teacher's test
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: testId } = await params

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { teacherId: true, title: true },
    })
    if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (test.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // All attempts + their errors + student names
    const attempts = await prisma.studentTestAttempt.findMany({
      where: { testId },
      orderBy: { finishedAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true } },
        studentErrors: {
          where: { sourceType: 'test' },
          include: {
            categories: {
              include: {
                category: { include: { translations: { where: { langCode: 'ru' } } } },
              },
            },
          },
        },
      },
    })

    // ── Top error categories ─────────────────────────────────────────────────
    const catMap: Record<string, { name: string; count: number }> = {}
    for (const attempt of attempts) {
      for (const err of attempt.studentErrors) {
        for (const c of err.categories) {
          const name = c.category.translations[0]?.name ?? c.category.slug
          if (!catMap[c.categoryId]) catMap[c.categoryId] = { name, count: 0 }
          catMap[c.categoryId].count++
        }
      }
    }
    const topCategories = Object.entries(catMap)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── Per-student breakdown ────────────────────────────────────────────────
    const studentMap: Record<string, {
      student: { id: string; name: string; avatarUrl: string | null }
      attemptCount: number
      avgPercent: number
      errors: { description: string | null; fragment: string | null; categories: { id: string; name: string }[]; createdAt: string }[]
    }> = {}

    for (const attempt of attempts) {
      const sid = attempt.student.id
      if (!studentMap[sid]) {
        studentMap[sid] = {
          student: attempt.student,
          attemptCount: 0,
          avgPercent: 0,
          errors: [],
        }
      }
      studentMap[sid].attemptCount++
      studentMap[sid].avgPercent += attempt.percent ?? 0

      for (const err of attempt.studentErrors) {
        studentMap[sid].errors.push({
          description: err.description,
          fragment: err.fragment,
          categories: err.categories.map(c => ({
            id: c.categoryId,
            name: c.category.translations[0]?.name ?? c.category.slug,
          })),
          createdAt: err.createdAt.toISOString(),
        })
      }
    }

    const byStudent = Object.values(studentMap).map(s => ({
      ...s,
      avgPercent: s.attemptCount > 0 ? Math.round(s.avgPercent / s.attemptCount) : 0,
    })).sort((a, b) => a.avgPercent - b.avgPercent) // worst performers first

    return NextResponse.json({
      testId,
      testTitle: test.title,
      totalAttempts: attempts.length,
      topCategories,
      byStudent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
