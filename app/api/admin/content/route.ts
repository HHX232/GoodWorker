import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const type      = searchParams.get('type')     ?? 'posts'
  const status    = searchParams.get('status')   ?? 'all'
  const aiFilter  = searchParams.get('aiFilter') ?? 'all'
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit     = 20

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.moderationStatus = status

  if (type === 'posts') {
    // AI filter only applies to posts
    if (aiFilter === 'flagged')   { where.aiModerated = true;  where.aiModerationOk = false }
    if (aiFilter === 'ok')        { where.aiModerationOk = true }
    if (aiFilter === 'unchecked') { where.aiModerated = false }

    const [items, total] = await Promise.all([
      (prisma.post.findMany as (a: unknown) => Promise<unknown[]>)({
        where,
        select: {
          id: true, title: true, moderationStatus: true, createdAt: true, viewCount: true,
          aiModerated: true, aiModerationOk: true,
          teacher: { select: { id: true, name: true } },
          _count: { select: { comments: true, ratings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma.post.count as (a: unknown) => Promise<number>)({ where }),
    ])
    return NextResponse.json({ items, total, totalPages: Math.ceil(total / limit) })
  } else {
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
      (prisma.roadmap.count as (a: unknown) => Promise<number>)({ where }),
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
    await (prisma.post.update as (a: unknown) => Promise<unknown>)({ where: { id }, data: { moderationStatus } })
  } else {
    await (prisma.roadmap.update as (a: unknown) => Promise<unknown>)({ where: { id }, data: { moderationStatus } })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id   = searchParams.get('id')
  const type = searchParams.get('type')
  if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 })

  if (type === 'posts') {
    await prisma.post.delete({ where: { id } })
  } else {
    await prisma.roadmap.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
