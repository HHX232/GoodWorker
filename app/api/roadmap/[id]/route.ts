import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { enrichRoadmapWithAI, localizeRoadmap } from '@/lib/postAI'
import { hasAIProvider } from '@/lib/openrouter'

interface Params {
  params: Promise<{ id: string }>
}

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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()

    const [roadmap, avgResult] = await Promise.all([
      prisma.roadmap.findUnique({
        where: { id },
        include: {
          teacher: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { comments: true, ratings: true } },
          accessList: { select: { studentId: true, grantedBy: true } },
        },
      }),
      prisma.roadmapRating.aggregate({
        where: { roadmapId: id },
        _avg: { stars: true },
      }),
    ])

    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // @ts-ignore
    if (roadmap.moderationStatus && roadmap.moderationStatus !== 'PUBLISHED' && session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const lang = req.nextUrl.searchParams.get('lang') ?? 'ru'
    const localized = localizeRoadmap(roadmap, lang)

    return NextResponse.json({
      ...localized,
      avgRating: avgResult._avg.stars ?? 0,
      mediaPreviewUrls: extractMediaPreviewUrls(localized.content),
    })
  } catch (error) {
    console.error('[GET /api/roadmap/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({ where: { id } })
    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, content, price, previewImageUrl, nodeAccessType, currency, categoryIds } = body

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(categoryIds)) {
        await tx.roadmapCategory.deleteMany({ where: { roadmapId: id } })
        if (categoryIds.length > 0) {
          await tx.roadmapCategory.createMany({
            data: categoryIds.map((cid: string) => ({ roadmapId: id, categoryId: cid })),
            skipDuplicates: true,
          })
        }
      }

      return tx.roadmap.update({
        where: { id },
        data: {
          ...(title?.trim() && { title: title.trim() }),
          ...(content !== undefined && { content }),
          ...(price !== undefined && { price: Number(price) || 0 }),
          ...(previewImageUrl !== undefined && { previewImageUrl }),
          ...(nodeAccessType !== undefined && { nodeAccessType: nodeAccessType ?? null }),
          ...(currency !== undefined && { currency }),
        },
        include: {
          teacher: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { comments: true, ratings: true } },
          roadmapCategories: { include: { category: { include: { translations: true } } } },
        },
      })
    })

    if (hasAIProvider() && (content !== undefined || title?.trim())) {
      enrichRoadmapWithAI(id).catch((e) => console.error('[roadmapAI]', e))
    }

    return NextResponse.json({
      ...updated,
      mediaPreviewUrls: extractMediaPreviewUrls(updated.content),
    })
  } catch (error) {
    console.error('[PATCH /api/roadmap/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({ where: { id } })
    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.roadmap.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/roadmap/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
