import {prisma} from '@/shared/prisma/prisma'
import {localizePost} from '@/lib/postAI'

export interface FetchPostsListParams {
  page?: number
  limit?: number
  categoryId?: string
  teacherId?: string
  search?: string
  onlyVip?: boolean
  sortBy?: 'viewCount' | 'createdAt'
  lang?: string
  userId?: string
  userRole?: string
}

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

  if (userRole === 'TEACHER' || userRole === 'ADMIN') {
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

// Shared by app/api/posts/route.ts (client-side re-fetches: filters, load
// more) and app/posts/page.tsx (initial SSR). The page used to call the
// route over HTTP via PostService.getList() — since that axios instance is
// pointed at the app's own public URL, every server-rendered load of
// /posts made two outbound round-trips to itself through the public
// edge/proxy before it could render anything. Calling this directly from
// the page skips that entirely.
export async function fetchPostsList(params: FetchPostsListParams) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 12))
  const skip = (page - 1) * limit
  const now = new Date()
  const sortBy = params.sortBy === 'viewCount' ? 'viewCount' : 'createdAt'

  const [categoryIds, visibilityWhere] = await Promise.all([
    params.categoryId ? getCategorySubtree(params.categoryId) : Promise.resolve(undefined),
    Promise.resolve(buildVisibilityWhere(params.userId, params.userRole))
  ])

  const baseFilters = [
    ...(params.onlyVip ? [{isVip: true, vipExpiresAt: {gt: now}}] : []),
    ...(categoryIds ? [{categoryId: {in: categoryIds}}] : []),
    ...(params.teacherId ? [{teacherId: params.teacherId}] : []),
    ...(params.search ? [{title: {contains: params.search, mode: 'insensitive' as const}}] : [])
  ]

  const postQueryConfig = {
    skip,
    take: limit,
    orderBy: {[sortBy]: 'desc'} as const,
    include: {
      teacher: {select: {id: true, name: true, avatarUrl: true}},
      _count: {select: {comments: true}}
    }
  }

  let posts: Awaited<ReturnType<typeof prisma.post.findMany>>
  let total: number

  try {
    const where = {AND: [visibilityWhere, {moderationStatus: 'PUBLISHED' as const}, ...baseFilters]}
    ;[posts, total] = await Promise.all([
      prisma.post.findMany({...postQueryConfig, where}),
      prisma.post.count({where})
    ])
  } catch {
    // moderationStatus column may not exist yet — query without it
    const where = {AND: [visibilityWhere, ...baseFilters]}
    ;[posts, total] = await Promise.all([
      prisma.post.findMany({...postQueryConfig, where}),
      prisma.post.count({where})
    ])
  }

  const postIds = posts.map((p) => p.id)
  const avgRatings = await prisma.postRating.groupBy({
    by: ['postId'],
    where: {postId: {in: postIds}},
    _avg: {stars: true}
  })
  const ratingMap = Object.fromEntries(avgRatings.map((r) => [r.postId, r._avg.stars ?? 0]))

  const lang = params.lang ?? 'ru'
  const postsWithRating = posts.map((p) => localizePost({...p, avgRating: ratingMap[p.id] ?? 0}, lang))

  return {
    posts: postsWithRating,
    pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
  }
}
