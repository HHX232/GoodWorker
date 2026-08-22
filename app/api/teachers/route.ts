import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import type {Prisma} from '@prisma/client'

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

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{isVip: 'desc'}, {createdAt: 'desc'}],
        select: {
          id: true,
          name: true,
          nameTransliterated: true,
          avatarUrl: true,
          isVip: true,
          lastSeenAt: true,
          languages: true,
          bio: true,
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
          _count: {select: {posts: true, students: true}},
          reviews: {select: {stars: true}},
          services: {select: {price: true, currency: true}, orderBy: {price: 'asc'}, take: 1}
        }
      }),
      prisma.teacher.count({where})
    ])

    const mapped = teachers.map(({reviews, services, ...teacher}) => {
      const cheapest = services[0]
      return {
        ...teacher,
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
