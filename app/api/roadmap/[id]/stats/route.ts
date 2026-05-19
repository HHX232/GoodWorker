import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

interface Params {
  params: Promise<{ id: string }>
}

function getWeekMonday(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

function groupByWeek(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const d of dates) {
    const key = getWeekMonday(d)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function last8Weeks(): string[] {
  const weeks: string[] = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    weeks.push(getWeekMonday(d))
  }
  return weeks
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: roadmapId } = await params
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { teacherId: true, price: true, content: true },
    })

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse node types from roadmap content
    const content = roadmap.content as {
      nodes?: { id: string; data?: { type?: string; activeComment?: unknown } }[]
    }
    const contentNodes = content?.nodes ?? []
    const testNodeIds = new Set(
      contentNodes.filter((n) => n.data?.type === 'ACTIVE_TEST').map((n) => n.id)
    )
    const feedbackNodeIds = new Set(
      contentNodes.filter((n) => n.data?.type === 'ACTIVE_COMMENT').map((n) => n.id)
    )
    const feedbackQuestionsMap = new Map(
      contentNodes
        .filter((n) => n.data?.type === 'ACTIVE_COMMENT')
        .map((n) => [n.id, n.data?.activeComment ?? []])
    )

    const [comments, complaints, accesses, allNodeFeedback, views] = await Promise.all([
      prisma.roadmapComment.findMany({
        where: { roadmapId },
        select: { createdAt: true },
      }),
      prisma.complaint.findMany({
        where: { roadmapId },
        select: { id: true, status: true, text: true, reply: true, repliedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.roadmapAccess.findMany({
        where: { roadmapId, grantedBy: 'PURCHASE' },
        select: { createdAt: true },
      }),
      prisma.roadmapNodeFeedback.findMany({
        where: { roadmapId },
        select: { nodeId: true, answers: true },
      }),
      prisma.roadmapView.findMany({
        where: { roadmapId },
        select: { viewedAt: true },
      }),
    ])

    const weeks = last8Weeks()
    const commentsByWeek = groupByWeek(comments.map((c) => c.createdAt))
    const purchasesByWeek = groupByWeek(accesses.map((a) => a.createdAt))
    const viewsByWeek = groupByWeek(views.map((v) => v.viewedAt))
    const price = roadmap.price ?? 0

    const viewPeriods = weeks.map((w) => ({ week: w, count: viewsByWeek.get(w) ?? 0 }))
    const commentPeriods = weeks.map((w) => ({ week: w, count: commentsByWeek.get(w) ?? 0 }))
    const purchasePeriods = weeks.map((w) => {
      const count = purchasesByWeek.get(w) ?? 0
      return { week: w, count, income: count * price }
    })

    const openComplaints = complaints.filter(
      (c) => c.status !== 'closed' && c.status !== 'resolved'
    )

    // Separate feedback and test results by node type
    const feedbackByNode = new Map<string, typeof allNodeFeedback>()
    const testByNode = new Map<string, typeof allNodeFeedback>()
    for (const f of allNodeFeedback) {
      if (feedbackNodeIds.has(f.nodeId)) {
        const arr = feedbackByNode.get(f.nodeId) ?? []
        arr.push(f)
        feedbackByNode.set(f.nodeId, arr)
      } else if (testNodeIds.has(f.nodeId)) {
        const arr = testByNode.get(f.nodeId) ?? []
        arr.push(f)
        testByNode.set(f.nodeId, arr)
      }
    }

    const feedbackStats = Array.from(feedbackByNode.entries()).map(([nodeId, subs]) => ({
      nodeId,
      questions: feedbackQuestionsMap.get(nodeId) ?? [],
      submissionCount: subs.length,
      submissions: subs.map((s) => ({ answers: s.answers })),
    }))

    const testStats = Array.from(testByNode.entries()).map(([nodeId, results]) => {
      const percents = results
        .map((r) => (r.answers as Record<string, unknown>)?.percent)
        .filter((p): p is number => typeof p === 'number')
      return {
        nodeId,
        submissionCount: results.length,
        avgPercent:
          percents.length > 0
            ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
            : null,
      }
    })

    return NextResponse.json({
      views: { total: views.length, byPeriod: viewPeriods },
      comments: { total: comments.length, byPeriod: commentPeriods },
      complaints: { total: complaints.length, open: openComplaints.length, items: complaints },
      purchases: {
        total: accesses.length,
        totalIncome: accesses.length * price,
        price,
        byPeriod: purchasePeriods,
      },
      feedback: feedbackStats,
      testResults: testStats,
    })
  } catch (error) {
    console.error('[GET /api/roadmap/:id/stats]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
