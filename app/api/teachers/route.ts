import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const {searchParams} = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? 12)))
    const search = searchParams.get('search') ?? ''
    const categoryId = searchParams.get('categoryId') ?? ''

    const where: {
      name?: {contains: string; mode: 'insensitive'}
      categories?: {some: {categoryId: string}}
    } = {}

    if (search) {
      where.name = {contains: search, mode: 'insensitive'}
    }

    if (categoryId) {
      where.categories = {some: {categoryId}}
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
          _count: {select: {posts: true, students: true}}
        }
      }),
      prisma.teacher.count({where})
    ])

    return NextResponse.json({
      teachers,
      pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
    })
  } catch (error) {
    console.error('[GET /api/teachers]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
