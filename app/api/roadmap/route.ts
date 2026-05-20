import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { enrichRoadmapWithAI, localizeRoadmap } from '@/lib/postAI'

function extractMediaPreviewUrls(content: unknown): string[] {
  try {
    const c = content as { nodes?: { data?: { type?: string; mediaItems?: { url: string; type: string }[] } }[] }
    if (!c?.nodes) return []
    const urls: string[] = []
    for (const node of c.nodes) {
      if (urls.length >= 2) break
      if (node.data?.type !== 'INFO_MEDIA') continue
      for (const item of node.data?.mediaItems ?? []) {
        if (item.type === 'image' && item.url && !item.url.startsWith('blob:')) {
          urls.push(item.url)
          if (urls.length >= 2) break
        }
      }
    }
    return urls
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, content, price = 0, previewImageUrl, nodeAccessType = null } = body

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    // VIP required to publish paid roadmaps
    if (Number(price) > 0) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: session.user.id },
        select: { isVip: true, vipExpiresAt: true },
      })
      const hasVip =
        teacher?.isVip === true &&
        (teacher.vipExpiresAt === null || teacher.vipExpiresAt > new Date())
      if (!hasVip) {
        return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })
      }
    }

    const roadmap = await prisma.roadmap.create({
      data: {
        teacherId: session.user.id,
        title: title.trim(),
        price: Number(price) || 0,
        content,
        previewImageUrl: previewImageUrl ?? null,
        nodeAccessType: nodeAccessType ?? null,
      },
      include: {
        teacher: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true, ratings: true } },
      },
    })

    if (process.env.GEMINI_API_KEY) {
      enrichRoadmapWithAI(roadmap.id).catch((e) => console.error('[roadmapAI]', e))
    }

    return NextResponse.json(
      { ...roadmap, mediaPreviewUrls: extractMediaPreviewUrls(content) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/roadmap]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit     = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const teacherId = searchParams.get('teacherId') ?? undefined
    const search    = searchParams.get('search') ?? undefined
    const minPriceRaw = searchParams.get('minPrice')
    const maxPriceRaw = searchParams.get('maxPrice')
    const minPrice  = minPriceRaw !== null && !isNaN(Number(minPriceRaw)) ? Number(minPriceRaw) : undefined
    const maxPrice  = maxPriceRaw !== null && !isNaN(Number(maxPriceRaw)) ? Number(maxPriceRaw) : undefined
    const minRating = parseFloat(searchParams.get('minRating') ?? '') || undefined

    // Фильтр по рейтингу — получаем подходящие id через groupBy
    let ratingIds: string[] | undefined
    if (minRating !== undefined) {
      const groups = await prisma.roadmapRating.groupBy({
        by: ['roadmapId'],
        _avg: { stars: true },
        having: { stars: { _avg: { gte: minRating } } },
      })
      ratingIds = groups.map((g) => g.roadmapId)
      // Если ни один не подходит — сразу пустой результат
      if (ratingIds.length === 0) {
        return NextResponse.json({ roadmaps: [], pagination: { page, limit, total: 0, totalPages: 0 } })
      }
    }

    const priceFilter =
      minPrice !== undefined || maxPrice !== undefined
        ? { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) }
        : undefined

    const baseWhere = {
      ...(teacherId && { teacherId }),
      ...(search && { title: { contains: search, mode: 'insensitive' as const } }),
      ...(priceFilter && { price: priceFilter }),
      ...(ratingIds !== undefined && { id: { in: ratingIds } }),
    }

    const roadmapSelect = {
      id: true,
      title: true,
      titleTranslations: true,
      price: true,
      previewImageUrl: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      nodeAccessType: true,
      teacher: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { comments: true, ratings: true } },
    } as const

    const roadmapQueryConfig = {
      orderBy: { createdAt: 'desc' } as const,
      skip: (page - 1) * limit,
      take: limit,
      select: roadmapSelect,
    }

    let roadmaps: Awaited<ReturnType<typeof prisma.roadmap.findMany<{select: typeof roadmapSelect}>>>
    let total: number

    try {
      const where = { moderationStatus: 'PUBLISHED' as const, ...baseWhere }
      ;[roadmaps, total] = await Promise.all([
        prisma.roadmap.findMany({...roadmapQueryConfig, where}),
        prisma.roadmap.count({where}),
      ])
    } catch {
      // moderationStatus column may not exist yet — query without it
      ;[roadmaps, total] = await Promise.all([
        prisma.roadmap.findMany({...roadmapQueryConfig, where: baseWhere}),
        prisma.roadmap.count({where: baseWhere}),
      ])
    }

    // Средний рейтинг для каждого роадмапа
    const ids = roadmaps.map((r) => r.id)
    const avgGroups = ids.length
      ? await prisma.roadmapRating.groupBy({
          by: ['roadmapId'],
          where: { roadmapId: { in: ids } },
          _avg: { stars: true },
        })
      : []
    const avgMap = new Map(avgGroups.map((g) => [g.roadmapId, g._avg.stars ?? 0]))

    const lang = searchParams.get('lang') ?? 'ru'
    const items = roadmaps.map(({ content, titleTranslations, ...r }) => {
      const localized = localizeRoadmap({ title: r.title, titleTranslations }, lang)
      return {
        ...r,
        title: localized.title,
        avgRating: avgMap.get(r.id) ?? 0,
        mediaPreviewUrls: extractMediaPreviewUrls(content),
      }
    })

    return NextResponse.json({
      roadmaps: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[GET /api/roadmap]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
