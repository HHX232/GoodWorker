import { prisma } from '@/shared/prisma/prisma'
import { enrichNotificationWithAI } from '@/lib/postAI'
import { NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

// POST /api/admin/notifications/backfill
// Enriches all notifications that have no translations yet with DeepSeek.
// Processes up to `batchSize` notifications per call to avoid timeouts.
export async function POST() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const batchSize = 20

  const untranslated = await (prisma.notification as any).findMany({
    where: { titleTranslations: null },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
  })

  if (untranslated.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, remaining: 0 })
  }

  // Run enrichments in parallel (DeepSeek handles concurrent requests)
  await Promise.allSettled(
    untranslated.map((n: { id: string }) => enrichNotificationWithAI(n.id))
  )

  const remaining = await (prisma.notification as any).count({
    where: { titleTranslations: null },
  })

  return NextResponse.json({ ok: true, processed: untranslated.length, remaining })
}
