import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

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

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params

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

    return NextResponse.json({
      ...roadmap,
      avgRating: avgResult._avg.stars ?? 0,
      mediaPreviewUrls: extractMediaPreviewUrls(roadmap.content),
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
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roadmap = await prisma.roadmap.findUnique({ where: { id } })
    if (!roadmap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (roadmap.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, content, price, previewImageUrl, nodeAccessType } = body

    const updated = await prisma.roadmap.update({
      where: { id },
      data: {
        ...(title?.trim() && { title: title.trim() }),
        ...(content !== undefined && { content }),
        ...(price !== undefined && { price: Number(price) || 0 }),
        ...(previewImageUrl !== undefined && { previewImageUrl }),
        ...(nodeAccessType !== undefined && { nodeAccessType: nodeAccessType ?? null }),
      },
      include: {
        teacher: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true, ratings: true } },
      },
    })

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
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
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
