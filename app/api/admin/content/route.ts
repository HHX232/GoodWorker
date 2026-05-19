import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? 'posts' // 'posts' | 'roadmaps'
  const status = searchParams.get('status') ?? 'all' // 'all' | 'PUBLISHED' | 'PENDING' | 'BLOCKED'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.moderationStatus = status

  if (type === 'posts') {
    // @ts-ignore
    const [items, total] = await Promise.all([
      (prisma.post.findMany as (a: unknown) => Promise<unknown[]>)({
        where,
        select: {
          id: true, title: true, moderationStatus: true, createdAt: true, viewCount: true,
          teacher: { select: { id: true, name: true } },
          _count: { select: { comments: true, ratings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // @ts-ignore
      prisma.post.count({ where }),
    ])
    return NextResponse.json({ items, total, totalPages: Math.ceil(total / limit) })
  } else {
    // @ts-ignore
    const [items, total] = await Promise.all([
      (prisma.roadmap.findMany as (a: unknown) => Promise<unknown[]>)({
        where,
        select: {
          id: true, title: true, moderationStatus: true, createdAt: true, price: true,
          teacher: { select: { id: true, name: true } },
          _count: { select: { comments: true, ratings: true, progress: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      // @ts-ignore
      prisma.roadmap.count({ where }),
    ])
    return NextResponse.json({ items, total, totalPages: Math.ceil(total / limit) })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, type, moderationStatus } = await req.json()
  if (!id || !type || !['PUBLISHED', 'PENDING', 'BLOCKED'].includes(moderationStatus)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  if (type === 'posts') {
    // @ts-ignore
    await prisma.post.update({ where: { id }, data: { moderationStatus } })
  } else {
    // @ts-ignore
    await prisma.roadmap.update({ where: { id }, data: { moderationStatus } })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const type = searchParams.get('type')
  if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 })

  if (type === 'posts') {
    await prisma.post.delete({ where: { id } })
  } else {
    await prisma.roadmap.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
