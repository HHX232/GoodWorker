import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// GET /api/notifications/stats?weeks=20
// Returns { days: Record<"YYYY-MM-DD", number> }
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const weeks = Math.min(52, Math.max(4, Number(searchParams.get('weeks') ?? 20)))
    const typesParam = searchParams.get('types') // comma-separated, e.g. "NEW_COMPLAINT,NEW_POST"
    const typesFilter = typesParam ? typesParam.split(',').filter(Boolean) : null

    const role   = session.user.role
    const userId = session.user.id

    const since = new Date()
    since.setDate(since.getDate() - weeks * 7)
    since.setUTCHours(0, 0, 0, 0)

    const recipientFilter =
      role === 'TEACHER'
        ? { teacherId: userId }
        : role === 'STUDENT'
          ? { studentId: userId }
          : { OR: [{ teacherId: userId }, { studentId: userId }] }

    const rows = await prisma.notification.findMany({
      where: {
        ...recipientFilter,
        createdAt: { gte: since },
        ...(typesFilter ? { type: { in: typesFilter } } : {}),
      },
      select: { createdAt: true },
    })

    const days: Record<string, number> = {}
    for (const { createdAt } of rows) {
      const key = createdAt.toISOString().slice(0, 10)
      days[key] = (days[key] ?? 0) + 1
    }

    return NextResponse.json({ days })
  } catch (error) {
    console.error('[GET /api/notifications/stats]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
