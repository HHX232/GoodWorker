import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { getLectureSettings, LECTURE_BILLING_ENABLED } from '@/shared/lib/lecture/pricing'

const INT_FIELDS = {
  baseMinutes: [0, 600],
  basePer5MinKopecks: [0, 1_000_000],
  extraPer5MinKopecks: [0, 1_000_000],
  aiInputPer1MKopecks: [0, 10_000_000],
  aiOutputPer1MKopecks: [0, 10_000_000],
  maxMinutesPerDay: [0, 1440],
} as const

// GET /api/admin/lecture-settings — the /lecture tariff and this month's totals.
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const [settings, month] = await Promise.all([
      getLectureSettings(),
      prisma.lectureNote.aggregate({
        where: { createdAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { recordedMs: true, costKopecks: true, aiPromptTokens: true, aiCompletionTokens: true },
      }),
    ])
    return NextResponse.json({
      settings,
      billingEnabled: LECTURE_BILLING_ENABLED,
      month: {
        lectures: month._count._all,
        minutes: Math.round((month._sum.recordedMs ?? 0) / 60_000),
        costKopecks: month._sum.costKopecks ?? 0,
        promptTokens: month._sum.aiPromptTokens ?? 0,
        completionTokens: month._sum.aiCompletionTokens ?? 0,
      },
    })
  } catch (e) {
    console.error('[GET /api/admin/lecture-settings]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/admin/lecture-settings — any subset of the tariff fields.
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const body = await req.json().catch(() => ({}))
    const data: Record<string, number> = {}
    for (const [key, [min, max]] of Object.entries(INT_FIELDS)) {
      if (body[key] === undefined) continue
      const v = body[key]
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return NextResponse.json({ error: `${key} must be an integer ${min}..${max}` }, { status: 400 })
      data[key] = v
    }
    if (body.aiMarkup !== undefined) {
      const v = body.aiMarkup
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return NextResponse.json({ error: 'aiMarkup must be 0..100' }, { status: 400 })
      data.aiMarkup = v
    }
    if (Object.keys(data).length) await prisma.lectureSettings.upsert({ where: { id: 'global' }, update: data, create: { id: 'global', ...data } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /api/admin/lecture-settings]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
