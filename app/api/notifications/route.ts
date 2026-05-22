import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { localizeNotification } from '@/lib/postAI'

// GET /api/notifications?page=1&limit=20&unread=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit
    const onlyUnread = searchParams.get('unread') === 'true'
    const dateParam  = searchParams.get('date') // YYYY-MM-DD — filter to this calendar day
    const lang = searchParams.get('lang') ?? 'ru'

    const role = session.user.role
    const userId = session.user.id

    const recipientFilter =
      role === 'TEACHER'
        ? { teacherId: userId }
        : role === 'STUDENT'
          ? { studentId: userId }
          : { OR: [{ teacherId: userId }, { studentId: userId }] }

    let dateFilter: { createdAt?: { gte: Date; lte: Date } } = {}
    if (dateParam) {
      // Use UTC boundaries — stats API also keys by UTC date (toISOString)
      const from = new Date(dateParam + 'T00:00:00.000Z')
      const to   = new Date(dateParam + 'T23:59:59.999Z')
      dateFilter = { createdAt: { gte: from, lte: to } }
    }

    const where = onlyUnread
      ? { ...recipientFilter, ...dateFilter, isRead: false }
      : { ...recipientFilter, ...dateFilter }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          titleTranslations: true,
          bodyTranslations: true,
          payload: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...recipientFilter, isRead: false } }),
    ])

    const localizedItems = items.map((n) => {
      const { titleTranslations, bodyTranslations, ...rest } = localizeNotification(n, lang)
      return rest
    })

    return NextResponse.json({
      items: localizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    })
  } catch (error) {
    console.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark as read
// Body: { ids: string[] } or { all: true }
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { ids?: string[]; all?: boolean }
    const role = session.user.role
    const userId = session.user.id

    const recipientFilter =
      role === 'TEACHER'
        ? { teacherId: userId }
        : { studentId: userId }

    if (body.all) {
      await prisma.notification.updateMany({
        where: { ...recipientFilter, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: { ...recipientFilter, id: { in: body.ids } },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Provide ids or all:true' }, { status: 400 })
  } catch (error) {
    console.error('[PATCH /api/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
