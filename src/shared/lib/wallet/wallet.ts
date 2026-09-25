import { prisma } from '@/shared/prisma/prisma'
import type { AIUsage } from '@/lib/openrouter'
import { auth } from '../../../../auth'
import {
  computeCostCents, computeVipMonthsGranted, DEFAULT_FEATURED_POSTS_PRICE_CENTS_PER_MONTH,
  DEFAULT_PINNED_LISTING_TIERS, DEFAULT_VIP_BONUS_TIERS, estimateMaxCostCents,
  type PinnedListingTier, type VipBonusTier,
} from './pricing'
import { NextResponse } from 'next/server'

export type WalletRole = 'TEACHER' | 'STUDENT'
export interface WalletUser {
  id: string
  role: WalletRole
}

/**
 * Resolves the current session to a wallet participant — own copy of the
 * ADMIN→TEACHER convention already used in `src/shared/lib/chat/access.ts`
 * and the calendar/payment-reminder routes (a seeded teacher logs in with
 * `role: 'ADMIN'`, same Teacher row). Not imported from the chat module —
 * wallet must not depend on chat (see interfaces.md).
 */
export async function getWalletSessionUser(): Promise<WalletUser | null> {
  const session = await auth()
  const role = session?.user?.role
  const id = session?.user?.id
  if (!id) return null
  if (role === 'TEACHER' || role === 'ADMIN') return { id, role: 'TEACHER' }
  if (role === 'STUDENT') return { id, role: 'STUDENT' }
  return null
}

/**
 * Reads the admin-configured AI markup percent from `WalletSettings` (id
 * `"global"`, singleton — same pattern as `getReferralSettings()` in
 * `src/lib/referralCode.ts`). Unlike that sibling, this does NOT upsert a
 * default row on read: `chargeForAICall`/`preflightCheck` call this on every
 * single AI request, and there's no reason to write a row just because
 * nobody has visited the admin panel yet — missing row simply means 0%.
 */
export async function getMarkupPercent(): Promise<number> {
  const row = await prisma.walletSettings.findUnique({ where: { id: 'global' }, select: { markupPercent: true } })
  return row?.markupPercent ?? 0
}

export async function setMarkupPercent(percent: number): Promise<void> {
  await prisma.walletSettings.upsert({
    where: { id: 'global' },
    update: { markupPercent: percent },
    create: { id: 'global', markupPercent: percent },
  })
}

export interface WalletPricingSettings {
  minDepositCents: number
  maxDepositCents: number
  usdToBynRate: number
  vipBonusTiers: VipBonusTier[]
  featuredPostsPriceCentsPerMonth: number
  pinnedListingTiers: PinnedListingTier[]
  storageOveragePriceCentsPerGbMonth: number
}

/**
 * Everything the /vip page needs to render prices — public (no auth), unlike
 * `getMarkupPercent` which stays admin-only (AI cost markup is a business
 * detail, not something to show a user). Falls back to the DEFAULT_* tables
 * if the row doesn't exist yet or a Json column isn't a valid array
 * (unvalidated at the DB level — same caution as `EventCard`'s
 * `eventPayload` elsewhere in the codebase).
 */
export async function getWalletPricingSettings(): Promise<WalletPricingSettings> {
  const row = await prisma.walletSettings.findUnique({
    where: { id: 'global' },
    select: {
      usdToBynRate: true, vipBonusTiers: true, featuredPostsPriceCentsPerMonth: true, pinnedListingTiers: true,
      storageOveragePriceCentsPerGbMonth: true,
    },
  })
  const vipTiers = Array.isArray(row?.vipBonusTiers) ? (row.vipBonusTiers as unknown as VipBonusTier[]) : DEFAULT_VIP_BONUS_TIERS
  const pinnedTiers = Array.isArray(row?.pinnedListingTiers) ? (row.pinnedListingTiers as unknown as PinnedListingTier[]) : DEFAULT_PINNED_LISTING_TIERS
  return {
    minDepositCents: MIN_DEPOSIT_CENTS,
    maxDepositCents: MAX_DEPOSIT_CENTS,
    usdToBynRate: row?.usdToBynRate ?? 3.2,
    vipBonusTiers: vipTiers.length > 0 ? vipTiers : DEFAULT_VIP_BONUS_TIERS,
    featuredPostsPriceCentsPerMonth: row?.featuredPostsPriceCentsPerMonth ?? DEFAULT_FEATURED_POSTS_PRICE_CENTS_PER_MONTH,
    pinnedListingTiers: pinnedTiers.length > 0 ? pinnedTiers : DEFAULT_PINNED_LISTING_TIERS,
    // 0 until an admin sets it (WalletSettings default) — chargeStorageOverage
    // no-ops at 0, see tutor-files interfaces.md "Контракт между тикетами".
    storageOveragePriceCentsPerGbMonth: row?.storageOveragePriceCentsPerGbMonth ?? 0,
  }
}

export async function setWalletPricingSettings(
  usdToBynRate: number,
  vipBonusTiers: VipBonusTier[],
  featuredPostsPriceCentsPerMonth: number,
  pinnedListingTiers: PinnedListingTier[],
  storageOveragePriceCentsPerGbMonth: number,
): Promise<void> {
  const data = {
    usdToBynRate,
    vipBonusTiers: vipBonusTiers as object,
    featuredPostsPriceCentsPerMonth,
    pinnedListingTiers: pinnedListingTiers as object,
    storageOveragePriceCentsPerGbMonth,
  }
  await prisma.walletSettings.upsert({ where: { id: 'global' }, update: data, create: { id: 'global', ...data } })
}

export async function getBalanceCents(user: WalletUser): Promise<number> {
  if (user.role === 'TEACHER') {
    const row = await prisma.teacher.findUnique({ where: { id: user.id }, select: { balanceCents: true } })
    return row?.balanceCents ?? 0
  }
  const row = await prisma.student.findUnique({ where: { id: user.id }, select: { balanceCents: true } })
  return row?.balanceCents ?? 0
}

export class InsufficientBalanceError extends Error {
  neededCents: number
  availableCents: number
  constructor(neededCents: number, availableCents: number) {
    super(`Insufficient balance: need ${neededCents} more cent(s), have ${availableCents}`)
    this.name = 'InsufficientBalanceError'
    this.neededCents = neededCents
    this.availableCents = availableCents
  }
}

/**
 * The one 402 body shape all 7 AI-billed routes use on `InsufficientBalanceError`
 * (R14i contract, see interfaces.md) — a single place so the 5 route handlers
 * don't each hand-roll the same object.
 */
export function insufficientBalanceResponse(err: InsufficientBalanceError): NextResponse {
  return NextResponse.json(
    {
      error: 'INSUFFICIENT_BALANCE',
      message: `Недостаточно средств: нужно ещё $${(err.neededCents / 100).toFixed(2)}`,
      neededCents: err.neededCents,
      availableCents: err.availableCents,
    },
    { status: 402 },
  )
}

/**
 * Preflight only — a plain read-and-compare against the conservative
 * `estimateMaxCostCents` upper bound, BEFORE the AI provider is called
 * (R14i.1). Not itself a lock or a guarantee against a concurrent charge
 * landing in between; that race is `chargeForAICall`'s job (R14i.2).
 *
 * Fetches the current admin-configured markup itself (`getMarkupPercent()`)
 * so callers just pass their endpoint/prompt size — same reason
 * `chargeForAICall` fetches it itself below, one less thing every route has
 * to remember to wire up.
 */
export async function preflightCheck(user: WalletUser, endpoint: string, promptChars: number, at: Date): Promise<void> {
  const markupPercent = await getMarkupPercent()
  const maxCostCents = estimateMaxCostCents(endpoint, promptChars, at, markupPercent)
  const availableCents = await getBalanceCents(user)
  if (availableCents < maxCostCents) {
    throw new InsufficientBalanceError(maxCostCents - availableCents, availableCents)
  }
}

const HUMAN_ENDPOINT_DESCRIPTION: Record<string, string> = {
  'whiteboard/formula-ai': 'Формула по описанию',
  'whiteboard/formula-photo': 'Формула по фото',
  'pdf-to-test/photos': 'Тест из фото',
  'pdf-to-test': 'Тест из документа',
  'tests/import-pdf': 'Импорт теста из PDF',
  'teacher/lesson-plan': 'План урока',
  'teacher/lesson-plan/revise': 'Правка плана урока',
}

export interface ChargeResult {
  costCents: number
  balanceAfterCents: number
  shortfallCents: number
}

type WalletTable = 'Teacher' | 'Student'

/**
 * Atomically zeroes the balance ONLY if it's still below `costCents` at the
 * moment this statement runs, and reports the exact value it zeroed from.
 * This is a single UPDATE (via a locking CTE), not a separate SELECT
 * followed by an unconditional write — a previous version of this function
 * read the balance, then wrote `balanceCents: 0` unconditionally, which left
 * a window where a concurrent `depositMock` increment landing in between
 * got silently clobbered back to 0. The `WHERE ... < $2 FOR UPDATE` here is
 * re-evaluated against the row's live state under its own lock, so a deposit
 * that already landed makes this a no-op (`zeroed: false`) instead of
 * overwriting it.
 */
async function zeroIfBelowCost(
  table: WalletTable,
  userId: string,
  costCents: number,
): Promise<{ zeroed: boolean; balanceBeforeCents: number }> {
  const rows = await prisma.$queryRawUnsafe<{ before: number }[]>(
    `WITH locked AS (
       SELECT "balanceCents" FROM "${table}" WHERE id = $1 AND "balanceCents" < $2 FOR UPDATE
     )
     UPDATE "${table}" t SET "balanceCents" = 0
     FROM locked
     WHERE t.id = $1
     RETURNING locked."balanceCents" AS "before"`,
    userId,
    costCents,
  )
  if (rows.length === 0) return { zeroed: false, balanceBeforeCents: 0 }
  return { zeroed: true, balanceBeforeCents: Number(rows[0].before) }
}

/**
 * Charges the real cost of one AI call, AFTER a successful response (R03.1 —
 * a failed call never reaches here, that's the caller's job to guarantee by
 * only calling this on success). `usage: null` (or a $0 cost) is a no-op:
 * nothing is debited and no ledger row is written — there is nothing to
 * record.
 *
 * Race safety (R14i.2): the decrement is a single conditional `updateMany`
 * (`balanceCents: {gte: cost}`) — Postgres' row-level lock inside that one
 * UPDATE statement is what actually prevents two concurrent charges from
 * both reading the same "sufficient" balance and double-spending it. If the
 * balance no longer covers the cost by the time this runs (a rare race with
 * another concurrent charge — preflight already passed), `zeroIfBelowCost`
 * atomically zeroes it instead of letting it go negative, recording exactly
 * how much wasn't covered. Both of those are single atomic statements re-
 * checked against live state — never a stale read written back later.
 *
 * The loop below only matters for a second-order race: a deposit landing in
 * the sliver of time between THIS charge's own two statements (decrement
 * attempt, then zero-if-still-short attempt) can flip the balance out from
 * under both conditions in the same pass — `zeroIfBelowCost` correctly
 * refuses to fire in that case (`zeroed: false`), and the loop just retries
 * the decrement, which should now succeed against the topped-up balance.
 */
export async function chargeForAICall(
  user: WalletUser,
  endpoint: string,
  usage: AIUsage,
  at: Date,
): Promise<ChargeResult> {
  const markupPercent = await getMarkupPercent()
  const costCents = computeCostCents(usage, at, markupPercent)
  const rawCostCents = computeCostCents(usage, at, 0)
  const totalTokens = usage === null ? null : usage.promptCacheHitTokens + usage.promptCacheMissTokens + usage.completionTokens
  if (costCents <= 0) {
    const balanceAfterCents = await getBalanceCents(user)
    return { costCents: 0, balanceAfterCents, shortfallCents: 0 }
  }

  const isTeacher = user.role === 'TEACHER'
  const table: WalletTable = isTeacher ? 'Teacher' : 'Student'
  const description = `Списание за: ${HUMAN_ENDPOINT_DESCRIPTION[endpoint] ?? endpoint}`

  const MAX_ATTEMPTS = 5
  let balanceAfterCents: number | null = null
  let shortfallCents = 0

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const decremented = isTeacher
      ? await prisma.teacher.updateMany({
          where: { id: user.id, balanceCents: { gte: costCents } },
          data: { balanceCents: { decrement: costCents } },
        })
      : await prisma.student.updateMany({
          where: { id: user.id, balanceCents: { gte: costCents } },
          data: { balanceCents: { decrement: costCents } },
        })

    if (decremented.count === 1) {
      balanceAfterCents = await getBalanceCents(user)
      shortfallCents = 0
      break
    }

    const zeroed = await zeroIfBelowCost(table, user.id, costCents)
    if (zeroed.zeroed) {
      shortfallCents = Math.max(costCents - zeroed.balanceBeforeCents, 0)
      balanceAfterCents = 0
      break
    }
    // Neither statement matched: a concurrent deposit pushed the balance to
    // >= cost between the two attempts above. Loop and retry the decrement.
  }

  if (balanceAfterCents === null) {
    // ponytail: MAX_ATTEMPTS exhausted means a deposit raced in on every
    // single attempt — never observed, only theoretically possible. Fail
    // open (this one AI call goes unbilled) rather than risk an
    // unconditional write that could re-introduce the clobbering bug this
    // function exists to avoid. Upgrade path: run the whole retry loop
    // inside one SERIALIZABLE transaction if this warning ever fires.
    console.warn(`[wallet] chargeForAICall: gave up after ${MAX_ATTEMPTS} attempts (endpoint=${endpoint}, user=${user.id})`)
    return { costCents: 0, balanceAfterCents: await getBalanceCents(user), shortfallCents: 0 }
  }

  await prisma.walletTransaction.create({
    data: {
      ...(isTeacher ? { teacherId: user.id } : { studentId: user.id }),
      userRole: user.role,
      type: 'AI_DEBIT',
      amountCents: costCents,
      balanceAfterCents,
      endpoint,
      shortfallCents: shortfallCents > 0 ? shortfallCents : null,
      description,
      rawCostCents,
      totalTokens,
    },
  })

  return { costCents, balanceAfterCents, shortfallCents }
}

const MIN_DEPOSIT_CENTS = 100 // $1
const MAX_DEPOSIT_CENTS = 100_000 // $1000
const VIP_BONUS_DAYS_PER_MONTH = 30

export class InvalidDepositAmountError extends Error {
  constructor(amountCents: number) {
    super(`amountCents must be an integer between ${MIN_DEPOSIT_CENTS} and ${MAX_DEPOSIT_CENTS}, got ${amountCents}`)
    this.name = 'InvalidDepositAmountError'
  }
}

export interface DepositResult {
  balanceAfterCents: number
  vipMonthsGranted: number
  vipExpiresAt: Date | null
}

/**
 * Mock deposit (R01/R09/R10.1) — there is no real payment provider yet, the
 * whole amount is treated as "paid" immediately. `>= $5` also grants VIP
 * months on top (R02/R02.1) at an admin-configurable rate that improves for
 * bigger deposits (`WalletSettings.vipBonusTiers`, see
 * `computeVipMonthsGranted` in pricing.ts), extending `vipExpiresAt` the
 * exact same way `app/api/teacher/vip/activate/route.ts` does for promo
 * codes: from the current expiry if it's still in the future, otherwise from
 * now. The deposited amount is never reduced by the VIP bonus — the full
 * amount stays on the balance for AI calls.
 */
export async function depositMock(user: WalletUser, amountCents: number): Promise<DepositResult> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_DEPOSIT_CENTS || amountCents > MAX_DEPOSIT_CENTS) {
    throw new InvalidDepositAmountError(amountCents)
  }

  const { vipBonusTiers } = await getWalletPricingSettings()
  const vipMonthsGranted = computeVipMonthsGranted(amountCents, vipBonusTiers)
  const now = new Date()
  const description = `Пополнение баланса на $${(amountCents / 100).toFixed(2)}`
  const isTeacher = user.role === 'TEACHER'

  // Interactive transaction (not the array form) because the VIP-expiry math
  // needs the pre-deposit `vipExpiresAt`, and the ledger row's
  // `balanceAfterCents` needs the post-increment balance — both only known
  // once earlier statements in this same transaction have actually run.
  return prisma.$transaction(async tx => {
    const current = isTeacher
      ? await tx.teacher.findUnique({ where: { id: user.id }, select: { vipExpiresAt: true } })
      : await tx.student.findUnique({ where: { id: user.id }, select: { vipExpiresAt: true } })

    let vipExpiresAt = current?.vipExpiresAt ?? null
    if (vipMonthsGranted > 0) {
      const base = vipExpiresAt && vipExpiresAt > now ? vipExpiresAt : now
      vipExpiresAt = new Date(base.getTime() + vipMonthsGranted * VIP_BONUS_DAYS_PER_MONTH * 24 * 60 * 60 * 1000)
    }

    const balanceUpdateData = {
      balanceCents: { increment: amountCents },
      ...(vipMonthsGranted > 0 ? { isVip: true, vipExpiresAt } : {}),
    }
    const balanceAfterCents = isTeacher
      ? (await tx.teacher.update({ where: { id: user.id }, data: balanceUpdateData, select: { balanceCents: true } })).balanceCents
      : (await tx.student.update({ where: { id: user.id }, data: balanceUpdateData, select: { balanceCents: true } })).balanceCents

    await tx.walletTransaction.create({
      data: {
        ...(isTeacher ? { teacherId: user.id } : { studentId: user.id }),
        userRole: user.role,
        type: 'DEPOSIT',
        amountCents,
        balanceAfterCents,
        description,
      },
    })

    if (vipMonthsGranted > 0) {
      await tx.vipTransaction.create({
        data: {
          ...(isTeacher ? { teacherId: user.id } : { studentId: user.id }),
          userRole: user.role,
          type: 'DEPOSIT',
          amount: amountCents / 100,
          description,
          vipGrantedUntil: vipExpiresAt,
        },
      })
    }

    return { balanceAfterCents, vipMonthsGranted, vipExpiresAt }
  })
}

// ─── Teacher add-ons (featured posts, pinned listing) — discrete debits ────

export type AddonKind = 'FEATURED_POSTS' | 'PINNED_LISTING'

export interface PurchaseAddonResult {
  balanceAfterCents: number
  until: Date
}

/**
 * Debits the wallet balance for a discrete teacher add-on and extends the
 * matching `*Until` field (same "extend from current expiry if still
 * active, else from now" rule as `depositMock`'s VIP bonus). Teacher-only —
 * both add-ons are about a teacher's own posts/listing, students have
 * neither. Unlike `chargeForAICall`, this is a plain upfront debit:
 * insufficient balance throws `InsufficientBalanceError` and nothing is
 * purchased — there's no already-happened AI call to reconcile against, so
 * there's nothing to partially charge.
 */
export async function purchaseAddon(user: WalletUser, kind: AddonKind, months: number, priceCents: number): Promise<PurchaseAddonResult> {
  if (user.role !== 'TEACHER') throw new Error('Addon purchases are teacher-only')
  if (!Number.isInteger(months) || months <= 0) throw new Error('months must be a positive integer')
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('priceCents must be a non-negative integer')

  const now = new Date()
  const description = kind === 'FEATURED_POSTS'
    ? `Выделение постов на ${months} мес.`
    : `Закрепление в списке репетиторов на ${months} мес.`

  const current = kind === 'FEATURED_POSTS'
    ? await prisma.teacher.findUnique({ where: { id: user.id }, select: { postsHighlightedUntil: true } })
    : await prisma.teacher.findUnique({ where: { id: user.id }, select: { pinnedInListUntil: true } })
  const currentUntil = kind === 'FEATURED_POSTS'
    ? (current as { postsHighlightedUntil: Date | null } | null)?.postsHighlightedUntil ?? null
    : (current as { pinnedInListUntil: Date | null } | null)?.pinnedInListUntil ?? null

  const base = currentUntil && currentUntil > now ? currentUntil : now
  const until = new Date(base.getTime() + months * VIP_BONUS_DAYS_PER_MONTH * 24 * 60 * 60 * 1000)
  const fieldUpdate = kind === 'FEATURED_POSTS' ? { postsHighlightedUntil: until } : { pinnedInListUntil: until }

  // ponytail: `until` is computed from a read before the conditional decrement
  // below, so two concurrent purchases by the same teacher could both extend
  // from the same base and one extension gets clobbered — the balance debit
  // itself stays race-safe (the `updateMany` WHERE is re-checked atomically
  // by Postgres), only the bonus-duration math has this tiny window. Upgrade
  // path: move the read inside a row-locking transaction like
  // `zeroIfBelowCost`, if this ever matters (a single user double-clicking).
  const decremented = await prisma.teacher.updateMany({
    where: { id: user.id, balanceCents: { gte: priceCents } },
    data: { balanceCents: { decrement: priceCents }, ...fieldUpdate },
  })

  if (decremented.count === 0) {
    const balanceCents = await getBalanceCents(user)
    throw new InsufficientBalanceError(priceCents - balanceCents, balanceCents)
  }

  const balanceAfterCents = await getBalanceCents(user)

  await prisma.walletTransaction.create({
    data: {
      teacherId: user.id,
      userRole: 'TEACHER',
      type: kind === 'FEATURED_POSTS' ? 'FEATURED_POSTS_PURCHASE' : 'PINNED_LISTING_PURCHASE',
      amountCents: priceCents,
      balanceAfterCents,
      description,
    },
  })

  return { balanceAfterCents, until }
}

/**
 * Monthly storage-overage debit for a VIP teacher whose tutor-file storage
 * exceeds `QUOTA_BYTES` (`tutorFiles/storage.ts`) — called by the
 * `storage-overage-billing` cron, one teacher at a time. Unlike
 * `purchaseAddon` (throws `InsufficientBalanceError` on a short balance),
 * this applies the same zero-floor `chargeForAICall` uses: the cron has no
 * user on the other end to show an error to, so it charges whatever's left
 * and moves on rather than throwing. `priceCentsPerGb <= 0` (admin hasn't set
 * a price yet, `WalletSettings.storageOveragePriceCentsPerGbMonth` defaults
 * to 0) is a no-op — nothing charged, no ledger row.
 */
export async function chargeStorageOverage(
  teacherId: string,
  overageGb: number,
  priceCentsPerGb: number,
  at: Date,
): Promise<ChargeResult> {
  const user: WalletUser = { id: teacherId, role: 'TEACHER' }
  const costCents = Math.round(overageGb * priceCentsPerGb)
  void at // no time-of-day pricing for storage overage — kept for signature symmetry with chargeForAICall

  if (costCents <= 0) {
    return { costCents: 0, balanceAfterCents: await getBalanceCents(user), shortfallCents: 0 }
  }

  const description = `Плата за превышение лимита хранилища: ${overageGb} ГБ сверх 7 ГБ`
  let balanceAfterCents: number | null = null
  let shortfallCents = 0

  // Two attempts, not chargeForAICall's 5 — this runs once a month from a
  // cron, not under real-time concurrency, so a second try after a
  // same-instant deposit race is enough; see zeroIfBelowCost's own doc for
  // why the decrement+zero pair is race-safe on its own without a retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    const decremented = await prisma.teacher.updateMany({
      where: { id: teacherId, balanceCents: { gte: costCents } },
      data: { balanceCents: { decrement: costCents } },
    })
    if (decremented.count === 1) {
      balanceAfterCents = await getBalanceCents(user)
      shortfallCents = 0
      break
    }

    const zeroed = await zeroIfBelowCost('Teacher', teacherId, costCents)
    if (zeroed.zeroed) {
      shortfallCents = Math.max(costCents - zeroed.balanceBeforeCents, 0)
      balanceAfterCents = 0
      break
    }
    // Neither matched: a concurrent deposit pushed the balance back to
    // >= cost between the two attempts above — loop once and retry the decrement.
  }

  if (balanceAfterCents === null) {
    // ponytail: exhausted both attempts (a deposit raced in on every one) —
    // fail open for this run, same call as chargeForAICall's MAX_ATTEMPTS
    // exhaustion. Next month's cron run picks up any remaining overage.
    console.warn(`[wallet] chargeStorageOverage: gave up after 2 attempts (teacher=${teacherId})`)
    return { costCents: 0, balanceAfterCents: await getBalanceCents(user), shortfallCents: 0 }
  }

  await prisma.walletTransaction.create({
    data: {
      teacherId,
      userRole: 'TEACHER',
      type: 'STORAGE_OVERAGE_DEBIT',
      amountCents: costCents,
      balanceAfterCents,
      shortfallCents: shortfallCents > 0 ? shortfallCents : null,
      description,
    },
  })

  return { costCents, balanceAfterCents, shortfallCents }
}

export interface WalletTransactionItem {
  id: string
  type: 'DEPOSIT' | 'AI_DEBIT' | 'FEATURED_POSTS_PURCHASE' | 'PINNED_LISTING_PURCHASE' | 'STORAGE_OVERAGE_DEBIT'
  amountCents: number
  balanceAfterCents: number
  endpoint: string | null
  description: string
  createdAt: Date
}

export interface ListTransactionsResult {
  items: WalletTransactionItem[]
  nextCursor: string | null
}

const DEFAULT_LIST_LIMIT = 30
const MAX_LIST_LIMIT = 100

/** Cursor pagination — same pattern as GET /api/chat/conversations/[id]/messages. */
export async function listTransactions(
  user: WalletUser,
  cursor?: string | null,
  limit: number = DEFAULT_LIST_LIMIT,
): Promise<ListTransactionsResult> {
  const take = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
  const idField = user.role === 'TEACHER' ? 'teacherId' : 'studentId'

  let cursorCreatedAt: Date | null = null
  if (cursor) {
    const cursorRow = await prisma.walletTransaction.findUnique({ where: { id: cursor }, select: { createdAt: true } })
    cursorCreatedAt = cursorRow?.createdAt ?? null
  }

  const rows = await prisma.walletTransaction.findMany({
    where: { [idField]: user.id, ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
  })

  const hasMore = rows.length > take
  const page = rows.slice(0, take)

  return {
    items: page.map(r => ({
      id: r.id,
      type: r.type,
      amountCents: r.amountCents,
      balanceAfterCents: r.balanceAfterCents,
      endpoint: r.endpoint,
      description: r.description,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  }
}
