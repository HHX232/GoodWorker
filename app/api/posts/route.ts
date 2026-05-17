import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'
import {localizePost} from '@/lib/postAI'

async function getCategorySubtree(categoryId: string): Promise<string[]> {
  const result = await prisma.$queryRaw<{id: string}[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM "Category" WHERE id = ${categoryId}
      UNION ALL
      SELECT c.id FROM "Category" c
      INNER JOIN subtree s ON c."parentId" = s.id
    )
    SELECT id FROM subtree
  `
  return result.map((r) => r.id)
}

function buildVisibilityWhere(userId?: string, userRole?: string) {
  if (!userId) return {visibility: 'PUBLIC' as const}

  if (userRole === 'TEACHER') {
    return {OR: [{visibility: 'PUBLIC' as const}, {teacherId: userId}]}
  }

  if (userRole === 'STUDENT') {
    return {
      OR: [
        {visibility: 'PUBLIC' as const},
        {
          visibility: 'STUDENTS' as const,
          teacher: {students: {some: {studentId: userId}}}
        },
        {
          visibility: 'SELECTED' as const,
          allowedStudents: {some: {studentId: userId}}
        }
      ]
    }
  }

  return {visibility: 'PUBLIC' as const}
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    const userRole = session?.user?.role

    const {searchParams} = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 12)))
    const categoryId = searchParams.get('categoryId') ?? undefined
    const teacherId = searchParams.get('teacherId') ?? undefined
    const search = searchParams.get('search') ?? undefined
    const onlyVip = searchParams.get('onlyVip') === 'true'
    const skip = (page - 1) * limit
    const now = new Date()

    // Параллельно получаем поддерево категорий и строим where
    const [categoryIds, visibilityWhere] = await Promise.all([
      categoryId ? getCategorySubtree(categoryId) : Promise.resolve(undefined),
      Promise.resolve(buildVisibilityWhere(userId, userRole))
    ])

    const where = {
      AND: [
        visibilityWhere,
        ...(onlyVip ? [{isVip: true, vipExpiresAt: {gt: now}}] : []),
        ...(categoryIds ? [{categoryId: {in: categoryIds}}] : []),
        ...(teacherId ? [{teacherId}] : []),
        ...(search ? [{title: {contains: search, mode: 'insensitive' as const}}] : [])
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: {createdAt: 'desc'},
        include: {
          teacher: {select: {id: true, name: true, avatarUrl: true}},
          _count: {select: {comments: true}}
        }
      }),
      prisma.post.count({where})
    ])

    const postIds = posts.map((p) => p.id)
    const avgRatings = await prisma.postRating.groupBy({
      by: ['postId'],
      where: {postId: {in: postIds}},
      _avg: {stars: true}
    })
    const ratingMap = Object.fromEntries(avgRatings.map((r) => [r.postId, r._avg.stars ?? 0]))

    const lang = searchParams.get('lang') ?? 'ru'
    const postsWithRating = posts.map((p) => localizePost({...p, avgRating: ratingMap[p.id] ?? 0}, lang))

    return NextResponse.json({
      posts: postsWithRating,
      pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
    })
  } catch (error) {
    console.error('[GET /api/posts]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
