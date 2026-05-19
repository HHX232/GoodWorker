import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalStudents, totalTeachers,
    newStudentsWeek, newTeachersWeek,
    newStudentsMonth, newTeachersMonth,
    vipStudents, vipTeachers,
    bannedStudents, bannedTeachers,
    totalPosts, totalRoadmaps,
    publishedPosts, pendingPosts, blockedPosts,
    publishedRoadmaps, pendingRoadmaps, blockedRoadmaps,
    pendingComplaints, totalComplaints,
    totalPromos, activePromos,
    recentTransactions,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.student.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.teacher.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.student.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.teacher.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.student.count({ where: { isVip: true } }),
    prisma.teacher.count({ where: { isVip: true } }),
    (prisma.student as any).count({ where: { isBanned: true } }),
    (prisma.teacher as any).count({ where: { isBanned: true } }),
    prisma.post.count(),
    prisma.roadmap.count(),
    (prisma.post as any).count({ where: { moderationStatus: 'PUBLISHED' } }),
    (prisma.post as any).count({ where: { moderationStatus: 'PENDING' } }),
    (prisma.post as any).count({ where: { moderationStatus: 'BLOCKED' } }),
    (prisma.roadmap as any).count({ where: { moderationStatus: 'PUBLISHED' } }),
    (prisma.roadmap as any).count({ where: { moderationStatus: 'PENDING' } }),
    (prisma.roadmap as any).count({ where: { moderationStatus: 'BLOCKED' } }),
    prisma.complaint.count({ where: { status: 'pending' } }),
    prisma.complaint.count(),
    prisma.promoCode.count(),
    prisma.promoCode.count({ where: { isActive: true } }),
    prisma.vipTransaction.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, createdAt: true, userRole: true, description: true,
        teacher: { select: { name: true } },
        student: { select: { name: true } },
        promoCode: { select: { code: true } },
      },
    }),
  ])

  return NextResponse.json({
    users: { totalStudents, totalTeachers, newStudentsWeek, newTeachersWeek, newStudentsMonth, newTeachersMonth, vipStudents, vipTeachers, bannedStudents: bannedStudents as number, bannedTeachers: bannedTeachers as number },
    content: { totalPosts, totalRoadmaps, publishedPosts, pendingPosts: pendingPosts as number, blockedPosts: blockedPosts as number, publishedRoadmaps, pendingRoadmaps: pendingRoadmaps as number, blockedRoadmaps: blockedRoadmaps as number },
    complaints: { pending: pendingComplaints, total: totalComplaints },
    promos: { total: totalPromos, active: activePromos },
    recentTransactions,
  })
}
