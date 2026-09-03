import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('teachers') }
}

import {prisma} from '@/shared/prisma/prisma'
import {resolveTeacherCategories} from '@/shared/utils/resolveRootCategory'
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
        nameTransliterated: true,
        avatarUrl: true,
        isVip: true,
        lastSeenAt: true,
        bio: true,
        categories: {
          select: {
            category: {
              select: {
                id: true,
                slug: true,
                translations: {select: {langCode: true, name: true}},
                parent: {
                  select: {
                    id: true,
                    slug: true,
                    translations: {select: {langCode: true, name: true}},
                    parent: {
                      select: {
                        id: true,
                        slug: true,
                        translations: {select: {langCode: true, name: true}}
                      }
                    }
                  }
                }
              }
            }
          }
        },
        languages: true,
        _count: {select: {posts: true, students: true}},
        reviews: {select: {stars: true}},
        services: {select: {price: true, currency: true}, orderBy: {price: 'asc'}, take: 1}
      }
    }),
    prisma.teacher.count()
  ])

  return {
    teachers: teachers.map(({reviews, services, categories, ...t}) => {
      const cheapest = services[0]
      return {
        ...t,
        categories: resolveTeacherCategories(categories),
        lastSeenAt: t.lastSeenAt ? t.lastSeenAt.toISOString() : null,
        avgRating: reviews.length ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length : null,
        reviewsCount: reviews.length,
        minPrice: cheapest?.price ?? null,
        minPriceCurrency: cheapest?.currency ?? null
      }
    }),
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
