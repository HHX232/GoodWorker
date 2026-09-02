import {prisma} from '@/shared/prisma/prisma'
import {resolveTeacherCategories} from '@/shared/utils/resolveRootCategory'
import {NextRequest, NextResponse} from 'next/server'
import type {Prisma} from '@prisma/client'

const CATEGORY_SELECT = {
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
}

// Composite ranking used only by sort=score (the "Учителя на платформе"
// leaderboard): raw student count would let one lucky early teacher dominate
// forever, so it's blended with rating quality and how much their content
// (posts/roadmaps) actually gets seen. Views are log-scaled because view
// counts run into the thousands while students/ratings are single digits —
// without dampening, views alone would decide the ranking.
const SCORE_WEIGHTS = {students: 10, rating: 3, views: 4, vip: 5}

function computeScore(t: {
  isVip: boolean
  avgRating: number | null
  reviewsCount: number
  totalViews: number
  _count: {students: number}
}): number {
  const weightedRating = t.avgRating !== null ? t.avgRating * t.reviewsCount : 0
  const viewsScore = Math.log10(1 + t.totalViews)
  return (
    t._count.students * SCORE_WEIGHTS.students +
    weightedRating * SCORE_WEIGHTS.rating +
    viewsScore * SCORE_WEIGHTS.views +
    (t.isVip ? SCORE_WEIGHTS.vip : 0)
  )
}

export async function GET(req: NextRequest) {
  try {
    const {searchParams} = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? 12)))
    const search = searchParams.get('search') ?? ''
    const categoryId = searchParams.get('categoryId') ?? ''
    const languages = searchParams.getAll('languages').filter(Boolean)
    const minPriceParam = searchParams.get('minPrice')
    const minPrice = minPriceParam ? Number(minPriceParam) : null
    const sort = searchParams.get('sort') ?? 'default'

    const where: Prisma.TeacherWhereInput = {}

    if (search) {
      where.name = {contains: search, mode: 'insensitive'}
    }

    if (categoryId) {
      where.categories = {some: {categoryId}}
    }

    if (languages.length) {
      where.languages = {hasSome: languages}
    }

    // "Минимальная стоимость урока" — тьютор проходит фильтр, если хотя бы
    // одна из его услуг стоит не меньше введённой суммы. Сравнение идёт по
    // сырому числу без конвертации валют (цены у большинства репетиторов —
    // в одной валюте; конвертация по устаревшим фиксированным курсам дала бы
    // ложную точность там, где валюты действительно различаются).
    if (minPrice !== null && !Number.isNaN(minPrice) && minPrice > 0) {
      where.services = {some: {price: {gte: minPrice}}}
    }

    const baseSelect = {
      id: true,
      name: true,
      nameTransliterated: true,
      avatarUrl: true,
      isVip: true,
      lastSeenAt: true,
      languages: true,
      bio: true,
      categories: CATEGORY_SELECT,
      _count: {select: {posts: true, students: true}},
      reviews: {select: {stars: true}},
      services: {select: {price: true, currency: true}, orderBy: {price: 'asc' as const}, take: 1}
    }

    // The seed/demo account is a placeholder, not a real tutor — it should
    // never outrank an actual teacher on the public leaderboard.
    const SEED_ACCOUNT_EMAIL = 'teacher@seed.dev'

    if (sort === 'score') {
      // Ranking depends on aggregates across every matching teacher, so it
      // can't be paginated at the DB level — fetch the whole matching set,
      // score in JS, then slice.
      const [all, total] = await Promise.all([
        prisma.teacher.findMany({
          where,
          select: {
            ...baseSelect,
            email: true,
            posts: {select: {viewCount: true}},
            roadmaps: {select: {_count: {select: {views: true}}}}
          }
        }),
        prisma.teacher.count({where})
      ])

      const scored = all.map(({reviews, services, posts, roadmaps, categories, email, ...teacher}) => {
        const cheapest = services[0]
        const totalViews =
          posts.reduce((sum, p) => sum + p.viewCount, 0) +
          roadmaps.reduce((sum, r) => sum + r._count.views, 0)
        const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length : null
        const reviewsCount = reviews.length
        const t = {
          ...teacher,
          categories: resolveTeacherCategories(categories),
          avgRating,
          reviewsCount,
          minPrice: cheapest?.price ?? null,
          minPriceCurrency: cheapest?.currency ?? null
        }
        const score = computeScore({isVip: teacher.isVip, avgRating, reviewsCount, totalViews, _count: teacher._count})
        return {t, score, isSeedAccount: email === SEED_ACCOUNT_EMAIL}
      })
      scored.sort((a, b) => {
        if (a.isSeedAccount !== b.isSeedAccount) return a.isSeedAccount ? 1 : -1
        return b.score - a.score
      })

      const start = (page - 1) * limit
      const mapped = scored.slice(start, start + limit).map(({t}) => t)

      return NextResponse.json({
        teachers: mapped,
        pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
      })
    }

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{isVip: 'desc'}, {createdAt: 'desc'}],
        select: baseSelect
      }),
      prisma.teacher.count({where})
    ])

    const mapped = teachers.map(({reviews, services, categories, ...teacher}) => {
      const cheapest = services[0]
      return {
        ...teacher,
        categories: resolveTeacherCategories(categories),
        avgRating: reviews.length ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length : null,
        reviewsCount: reviews.length,
        minPrice: cheapest?.price ?? null,
        minPriceCurrency: cheapest?.currency ?? null
      }
    })

    return NextResponse.json({
      teachers: mapped,
      pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
    })
  } catch (error) {
    console.error('[GET /api/teachers]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
