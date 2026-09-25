import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { getStoragePricing, setStoragePrice, STORAGE_BILLING_ENABLED } from '@/shared/lib/tutorFiles/billing'
import { getStorageLimits } from '@/shared/lib/tutorFiles/storage'
import { MAX_FILE_MB_RANGE, QUOTA_GB_RANGE } from '@/shared/lib/tutorFiles/constants'

const MAX_PRICE_CENTS = 100_000

// GET /api/admin/storage — settings (quota, per-file cap, price when billing
// is on), totals and every tutor with files, heaviest first.
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const [limits, pricing, usage, folderCounts, unindexed] = await Promise.all([
      getStorageLimits(),
      getStoragePricing(),
      prisma.tutorFile.groupBy({ by: ['teacherId'], _sum: { sizeBytes: true }, _count: { _all: true } }),
      prisma.tutorFolder.groupBy({ by: ['teacherId'], _count: { _all: true } }),
      prisma.tutorFile.count({ where: { contentText: null } }),
    ])
    const ids = [...new Set([...usage.map(u => u.teacherId), ...folderCounts.map(f => f.teacherId)])]
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, avatarUrl: true, isVip: true, vipExpiresAt: true },
    })
    const now = new Date()
    const foldersBy = new Map(folderCounts.map(f => [f.teacherId, f._count._all]))
    const usageBy = new Map(usage.map(u => [u.teacherId, u]))
    const tutors = teachers
      .map(t => ({
        id: t.id,
        name: t.name,
        email: t.email,
        avatarUrl: t.avatarUrl,
        isVip: t.isVip && (t.vipExpiresAt === null || t.vipExpiresAt > now),
        usedBytes: usageBy.get(t.id)?._sum.sizeBytes ?? 0,
        files: usageBy.get(t.id)?._count._all ?? 0,
        folders: foldersBy.get(t.id) ?? 0,
      }))
      .sort((a, b) => b.usedBytes - a.usedBytes)

    return NextResponse.json({
      settings: { quotaGb: limits.quotaGb, maxFileMb: limits.maxFileMb },
      billingEnabled: STORAGE_BILLING_ENABLED,
      priceCentsPerGbMonth: pricing?.priceCentsPerGbMonth ?? null,
      totals: {
        usedBytes: tutors.reduce((n, t) => n + t.usedBytes, 0),
        files: tutors.reduce((n, t) => n + t.files, 0),
        folders: tutors.reduce((n, t) => n + t.folders, 0),
        tutors: tutors.length,
        overQuota: tutors.filter(t => t.usedBytes > limits.quotaBytes).length,
        unindexed,
      },
      tutors,
    })
  } catch (e) {
    console.error('[GET /api/admin/storage]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/admin/storage {quotaGb?, maxFileMb?, priceCentsPerGbMonth?}
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const body = await req.json().catch(() => ({}))
    const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)
    const data: { quotaGb?: number; maxFileMb?: number } = {}
    if (body.quotaGb !== undefined) {
      const v = int(body.quotaGb)
      if (v === null || v < QUOTA_GB_RANGE.min || v > QUOTA_GB_RANGE.max) return NextResponse.json({ error: `quotaGb must be ${QUOTA_GB_RANGE.min}..${QUOTA_GB_RANGE.max}` }, { status: 400 })
      data.quotaGb = v
    }
    if (body.maxFileMb !== undefined) {
      const v = int(body.maxFileMb)
      if (v === null || v < MAX_FILE_MB_RANGE.min || v > MAX_FILE_MB_RANGE.max) return NextResponse.json({ error: `maxFileMb must be ${MAX_FILE_MB_RANGE.min}..${MAX_FILE_MB_RANGE.max}` }, { status: 400 })
      data.maxFileMb = v
    }
    if (Object.keys(data).length) {
      await prisma.storageSettings.upsert({ where: { id: 'global' }, update: data, create: { id: 'global', ...data } })
    }
    if (body.priceCentsPerGbMonth !== undefined) {
      const v = int(body.priceCentsPerGbMonth)
      if (!STORAGE_BILLING_ENABLED) return NextResponse.json({ error: 'Billing is not enabled in this build' }, { status: 400 })
      if (v === null || v < 0 || v > MAX_PRICE_CENTS) return NextResponse.json({ error: `priceCentsPerGbMonth must be 0..${MAX_PRICE_CENTS}` }, { status: 400 })
      await setStoragePrice(v)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /api/admin/storage]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
