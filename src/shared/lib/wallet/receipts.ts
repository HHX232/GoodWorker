import { prisma } from '@/shared/prisma/prisma'
import { getUsedBytes, QUOTA_BYTES } from '@/shared/lib/tutorFiles/storage'
import { getMonthlyFeeStatus, getWalletPricingSettings, type WalletUser } from './wallet'

/**
 * "Receipts" for the recurring things on /wallet — one card per service that
 * charges on a schedule or runs for a paid period: the monthly VIP fee,
 * pinned listing, featured posts and storage overage. Line `key`s are
 * translated client-side (wallet.receipts.lines.*); amounts are USD cents.
 */
export type ReceiptId = 'VIP_FEE' | 'PINNED_LISTING' | 'FEATURED_POSTS' | 'STORAGE'
export type ReceiptStatus = 'ACTIVE' | 'ENDING_SOON' | 'INACTIVE' | 'FREE'

export interface ReceiptLine {
  key: 'feeBase' | 'spentAi' | 'spentPinned' | 'spentStorage' | 'feeCredit' | 'purchase' | 'storageUsed' | 'storageOverage'
  count?: number
  months?: number
  at?: Date
  amountCents: number
  /** Credit lines render with a minus and are subtracted in the total. */
  credit?: boolean
}

export interface Receipt {
  id: ReceiptId
  status: ReceiptStatus
  activeUntil: Date | null
  periodStart: Date | null
  periodEnd: Date | null
  nextChargeAt: Date | null
  lines: ReceiptLine[]
  totalCents: number
  /** DUE: will be debited at nextChargeAt. PAID: sum of the listed purchases. */
  totalKind: 'DUE' | 'PAID'
  /** Previous monthly-fee debits (VIP only), newest first. */
  history: { at: Date; amountCents: number }[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const ENDING_SOON_DAYS = 7
const PURCHASES_SHOWN = 6

function periodStatus(until: Date | null, now: Date): ReceiptStatus {
  if (!until || until <= now) return 'INACTIVE'
  return until.getTime() - now.getTime() <= ENDING_SOON_DAYS * DAY_MS ? 'ENDING_SOON' : 'ACTIVE'
}

/** Storage overage cron runs 03:00 UTC on the 1st (vercel.json). */
function nextStorageBillingAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 3, 0, 0))
}

function monthsFromDescription(description: string): number | undefined {
  const m = description.match(/(\d+)\s*мес/)
  return m ? Number(m[1]) : undefined
}

async function vipFeeReceipt(user: WalletUser, now: Date): Promise<Receipt> {
  const owner = user.role === 'TEACHER' ? { teacherId: user.id } : { studentId: user.id }
  const [fee, vipRow, history] = await Promise.all([
    getMonthlyFeeStatus(user, now),
    user.role === 'TEACHER'
      ? prisma.teacher.findUnique({ where: { id: user.id }, select: { vipExpiresAt: true } })
      : prisma.student.findUnique({ where: { id: user.id }, select: { vipExpiresAt: true } }),
    prisma.walletTransaction.findMany({
      where: { ...owner, type: 'MONTHLY_FEE' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { createdAt: true, amountCents: true },
    }),
  ])

  const base: Receipt = {
    id: 'VIP_FEE',
    status: 'INACTIVE',
    activeUntil: vipRow?.vipExpiresAt ?? null,
    periodStart: null,
    periodEnd: null,
    nextChargeAt: null,
    lines: [],
    totalCents: 0,
    totalKind: 'DUE',
    history: history.map(h => ({ at: h.createdAt, amountCents: h.amountCents })),
  }
  if (!fee.active || !fee.periodStart || !fee.periodEnd) return base

  const byType = await prisma.walletTransaction.groupBy({
    by: ['type'],
    where: {
      ...owner,
      type: { in: ['AI_DEBIT', 'PINNED_LISTING_PURCHASE', 'STORAGE_OVERAGE_DEBIT'] },
      createdAt: { gte: fee.periodStart, lt: now },
    },
    _sum: { amountCents: true },
    _count: { _all: true },
  })
  const pick = (type: string) => byType.find(g => g.type === type)
  const spentLine = (key: ReceiptLine['key'], type: string): ReceiptLine[] => {
    const g = pick(type)
    return g && (g._sum.amountCents ?? 0) > 0 ? [{ key, count: g._count._all, amountCents: g._sum.amountCents ?? 0 }] : []
  }

  const credit = Math.min(fee.spentCents, fee.feeCents)
  return {
    ...base,
    status: periodStatus(vipRow?.vipExpiresAt ?? null, now) === 'ENDING_SOON' ? 'ENDING_SOON' : 'ACTIVE',
    periodStart: fee.periodStart,
    periodEnd: fee.periodEnd,
    nextChargeAt: fee.periodEnd,
    lines: [
      { key: 'feeBase', amountCents: fee.feeCents },
      ...spentLine('spentAi', 'AI_DEBIT'),
      ...spentLine('spentPinned', 'PINNED_LISTING_PURCHASE'),
      ...spentLine('spentStorage', 'STORAGE_OVERAGE_DEBIT'),
      ...(credit > 0 ? [{ key: 'feeCredit' as const, amountCents: credit, credit: true }] : []),
    ],
    totalCents: fee.projectedChargeCents,
  }
}

async function addonReceipt(
  teacherId: string,
  id: 'PINNED_LISTING' | 'FEATURED_POSTS',
  until: Date | null,
  now: Date,
): Promise<Receipt> {
  const purchases = await prisma.walletTransaction.findMany({
    where: { teacherId, type: id === 'PINNED_LISTING' ? 'PINNED_LISTING_PURCHASE' : 'FEATURED_POSTS_PURCHASE' },
    orderBy: { createdAt: 'desc' },
    take: PURCHASES_SHOWN,
    select: { createdAt: true, amountCents: true, description: true },
  })
  const lines: ReceiptLine[] = purchases.map(p => ({
    key: 'purchase',
    months: monthsFromDescription(p.description),
    at: p.createdAt,
    amountCents: p.amountCents,
  }))
  return {
    id,
    status: periodStatus(until, now),
    activeUntil: until,
    periodStart: null,
    periodEnd: until,
    nextChargeAt: null,
    lines,
    totalCents: lines.reduce((s, l) => s + l.amountCents, 0),
    totalKind: 'PAID',
    history: [],
  }
}

async function storageReceipt(teacherId: string, isVip: boolean, now: Date): Promise<Receipt> {
  const [usedBytes, { storageOveragePriceCentsPerGbMonth: price }] = await Promise.all([
    getUsedBytes(teacherId),
    getWalletPricingSettings(),
  ])
  const overGb = usedBytes > QUOTA_BYTES ? Math.ceil((usedBytes - QUOTA_BYTES) / 1024 ** 3) : 0
  // Same conditions as the storage-overage cron: VIP only, price must be set.
  const dueCents = isVip && price > 0 ? overGb * price : 0
  return {
    id: 'STORAGE',
    status: overGb > 0 && dueCents > 0 ? 'ACTIVE' : 'FREE',
    activeUntil: null,
    periodStart: null,
    periodEnd: null,
    nextChargeAt: dueCents > 0 ? nextStorageBillingAt(now) : null,
    lines: [
      { key: 'storageUsed', count: Math.round((usedBytes / 1024 ** 3) * 100) / 100, amountCents: 0 },
      ...(overGb > 0 ? [{ key: 'storageOverage' as const, count: overGb, amountCents: dueCents }] : []),
    ],
    totalCents: dueCents,
    totalKind: 'DUE',
    history: [],
  }
}

export async function getRecurringReceipts(user: WalletUser, now: Date = new Date()): Promise<Receipt[]> {
  const vip = await vipFeeReceipt(user, now)
  if (user.role !== 'TEACHER') return [vip]

  const t = await prisma.teacher.findUnique({
    where: { id: user.id },
    select: { pinnedInListUntil: true, postsHighlightedUntil: true, isVip: true, vipExpiresAt: true },
  })
  const isVip = !!t?.isVip && (t.vipExpiresAt === null || t.vipExpiresAt > now)
  const [pinned, featured, storage] = await Promise.all([
    addonReceipt(user.id, 'PINNED_LISTING', t?.pinnedInListUntil ?? null, now),
    addonReceipt(user.id, 'FEATURED_POSTS', t?.postsHighlightedUntil ?? null, now),
    storageReceipt(user.id, isVip, now),
  ])
  return [vip, pinned, featured, storage]
}
