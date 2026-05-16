import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// GET /api/student/errors?sort=time|freq&limit=50
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') ?? 'time'   // 'time' | 'freq'
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
    const studentId = session.user.id

    const errors = await prisma.studentError.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: sort === 'time' ? limit : undefined,
      include: {
        categories: {
          include: {
            category: {
              include: { translations: { where: { langCode: 'ru' } } },
            },
          },
        },
      },
    })

    if (sort === 'time') {
      const result = errors.map(e => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        description: e.description,
        fragment: e.fragment,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        categories: e.categories.map(c => ({
          id: c.categoryId,
          name: c.category.translations[0]?.name ?? c.category.slug,
        })),
      }))
      return NextResponse.json({ sort: 'time', errors: result })
    }

    // sort === 'freq': group by category, return categories sorted by count
    const catMap: Record<string, { name: string; count: number; lastSeen: string }> = {}
    for (const e of errors) {
      for (const c of e.categories) {
        const name = c.category.translations[0]?.name ?? c.category.slug
        if (!catMap[c.categoryId]) {
          catMap[c.categoryId] = { name, count: 0, lastSeen: e.createdAt.toISOString() }
        }
        catMap[c.categoryId].count++
        if (e.createdAt.toISOString() > catMap[c.categoryId].lastSeen) {
          catMap[c.categoryId].lastSeen = e.createdAt.toISOString()
        }
      }
    }

    const categories = Object.entries(catMap)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return NextResponse.json({ sort: 'freq', categories })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
