import { prisma } from '@/shared/prisma/prisma'
import { ALL_NOTIFICATION_TYPES, DEFAULT_SUBSCRIPTIONS, NotificationType } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// GET /api/notifications/subscriptions
// Returns all notification types with enabled/disabled status for the current user
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const role = session.user.role ?? 'STUDENT'
    const defaults = new Set<string>(DEFAULT_SUBSCRIPTIONS[role] ?? [])

    const existing = await prisma.notificationSubscription.findMany({
      where: { userId },
    })
    const existingMap = new Map(existing.map((s) => [s.type, s.enabled]))

    const subscriptions = ALL_NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: existingMap.has(type) ? existingMap.get(type)! : defaults.has(type),
    }))

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('[GET /api/notifications/subscriptions]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications/subscriptions
// Body: { updates: { type: string; enabled: boolean }[] }
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const role = session.user.role ?? 'STUDENT'
    const body = await req.json() as { updates: { type: string; enabled: boolean }[] }

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 })
    }

    // Only allow known types
    const validTypes = new Set<string>(ALL_NOTIFICATION_TYPES)
    const filtered = body.updates.filter((u) => validTypes.has(u.type))

    await Promise.all(
      filtered.map((u) =>
        prisma.notificationSubscription.upsert({
          where: { userId_type: { userId, type: u.type } },
          create: { userId, userRole: role, type: u.type as NotificationType, enabled: u.enabled },
          update: { enabled: u.enabled },
        })
      )
    )

    return NextResponse.json({ ok: true, updated: filtered.length })
  } catch (error) {
    console.error('[PATCH /api/notifications/subscriptions]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
