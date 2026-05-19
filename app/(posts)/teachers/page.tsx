import {prisma} from '@/shared/prisma/prisma'
import TeachersPage from '@/_pages/PublickPages/TeachersPage/TeachersPage'

const PAGE_LIMIT = 12

async function getInitialTeachers() {
  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      take: PAGE_LIMIT,
      orderBy: [{isVip: 'desc'}, {createdAt: 'desc'}],
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isVip: true,
        lastSeenAt: true,
        categories: {
          select: {
            category: {
              select: {
                id: true,
                slug: true,
                translations: {select: {langCode: true, name: true}}
              }
            }
          }
        },
        languages: true,
        _count: {select: {posts: true, students: true}}
      }
    }),
    prisma.teacher.count()
  ])

  return {
    teachers: teachers.map((t) => ({
      ...t,
      lastSeenAt: t.lastSeenAt ? t.lastSeenAt.toISOString() : null
    })),
    pagination: {
      page: 1,
      limit: PAGE_LIMIT,
      total,
      totalPages: Math.ceil(total / PAGE_LIMIT)
    }
  }
}

export default async function TeachersServerPage() {
  const initialData = await getInitialTeachers()
  return <TeachersPage initialData={initialData} />
}
