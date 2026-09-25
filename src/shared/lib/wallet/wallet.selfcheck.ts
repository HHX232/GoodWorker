// Self-check for wallet.ts's chargeForAICall — run with
// `npx tsx src/shared/lib/wallet/wallet.selfcheck.ts` against the real dev DB
// (DATABASE_URL from .env). No test runner in this project. Creates and
// tears down its own throwaway Teacher row — does not touch seed accounts.
import { prisma } from '@/shared/prisma/prisma'
import { chargeForAICall, depositMock, InsufficientBalanceError, purchaseAddon, type WalletUser } from './wallet'
import type { AIUsage } from '@/lib/openrouter'

let failures = 0
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++
    console.error(`FAIL ${label}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

const NOW = new Date('2026-09-19T12:00:00Z') // Saturday — deterministically non-peak

async function main() {
  const teacher = await prisma.teacher.create({
    data: {
      name: 'Wallet Selfcheck',
      email: `wallet-selfcheck-${Date.now()}@example.test`,
      balanceCents: 150,
    },
    select: { id: true },
  })
  const user: WalletUser = { id: teacher.id, role: 'TEACHER' }

  try {
    // ── Race: two concurrent charges of 100c each against a 150c balance ──
    // Only one can be fully covered; the conditional `updateMany` (not a
    // read-then-write in JS) is what makes Postgres serialize the two
    // UPDATEs on the same row — the loser sees the post-first-charge balance
    // (50c), fails its `gte: 100` condition, and gets zeroed instead of
    // going negative (R14i.2).
    // Output-only usage at the non-peak rate ($0.60/1M): 1,666,666 tokens ->
    // $0.9999996 -> ceil to exactly 100 cents. Picked to land just under the
    // cent boundary so the ceil is unambiguous (not an artifact of float
    // rounding landing exactly on 100.0).
    const usageForExactly100Cents: AIUsage = { promptCacheMissTokens: 0, promptCacheHitTokens: 0, completionTokens: 1_666_666 }

    const [a, b] = await Promise.all([
      chargeForAICall(user, 'wallet-selfcheck/race', usageForExactly100Cents, NOW),
      chargeForAICall(user, 'wallet-selfcheck/race', usageForExactly100Cents, NOW),
    ])

    assert(a.costCents === 100 && b.costCents === 100, 'chargeForAICall: computed cost is 100c for both concurrent calls')

    const finalBalance = await prisma.teacher.findUnique({ where: { id: teacher.id }, select: { balanceCents: true } })
    assert(finalBalance?.balanceCents === 0, 'chargeForAICall: balance never goes negative — ends at exactly 0, not -50')

    const balancesAfter = [a.balanceAfterCents, b.balanceAfterCents].sort((x, y) => x - y)
    assert(
      balancesAfter[0] === 0 && balancesAfter[1] === 50,
      'chargeForAICall: one charge fully succeeds (150->50), the other is capped at 0 rather than going to -50',
    )

    const shortfalls = [a.shortfallCents, b.shortfallCents].sort((x, y) => x - y)
    assert(
      shortfalls[0] === 0 && shortfalls[1] === 50,
      'chargeForAICall: the capped charge records shortfallCents=50 (100 needed, only 50 available); the other records 0',
    )

    const debitRows = await prisma.walletTransaction.count({ where: { teacherId: teacher.id, type: 'AI_DEBIT' } })
    assert(debitRows === 2, 'chargeForAICall: exactly 2 AI_DEBIT ledger rows written for the 2 charges (none skipped, none duplicated)')

    // ── No usage (failed AI call before a response) never touches the wallet ──
    const beforeNullCharge = await prisma.teacher.findUnique({ where: { id: teacher.id }, select: { balanceCents: true } })
    const nullResult = await chargeForAICall(user, 'wallet-selfcheck/no-usage', null, NOW)
    const afterNullCharge = await prisma.teacher.findUnique({ where: { id: teacher.id }, select: { balanceCents: true } })

    assert(nullResult.costCents === 0, 'chargeForAICall: usage=null computes to 0 cost')
    assert(beforeNullCharge?.balanceCents === afterNullCharge?.balanceCents, 'chargeForAICall: usage=null leaves the balance untouched')

    const debitRowsAfterNull = await prisma.walletTransaction.count({ where: { teacherId: teacher.id, type: 'AI_DEBIT' } })
    assert(debitRowsAfterNull === 2, 'chargeForAICall: usage=null creates no AI_DEBIT ledger row')
  } finally {
    // Teardown — this is a throwaway row, not a seed account.
    await prisma.walletTransaction.deleteMany({ where: { teacherId: teacher.id } })
    await prisma.teacher.delete({ where: { id: teacher.id } })
  }

  // ── Regression: a concurrent deposit racing an insufficient-balance charge
  // must never get clobbered by the charge's zero-out. This is the exact bug
  // reported in review — the previous version read the balance, then wrote
  // `balanceCents: 0` unconditionally, so a deposit landing in that window
  // was silently erased. `zeroIfBelowCost` re-checks `balanceCents < cost`
  // atomically at write time, so whichever operation wins the row lock,
  // BOTH effects survive: the balance ends at either 950 or 1000 depending
  // on interleaving, never 0.
  const teacher2 = await prisma.teacher.create({
    data: {
      name: 'Wallet Selfcheck 2',
      email: `wallet-selfcheck2-${Date.now()}@example.test`,
      balanceCents: 50,
    },
    select: { id: true },
  })
  const user2: WalletUser = { id: teacher2.id, role: 'TEACHER' }

  try {
    const usageForExactly100Cents: AIUsage = { promptCacheMissTokens: 0, promptCacheHitTokens: 0, completionTokens: 1_666_666 }

    const [chargeResult] = await Promise.all([
      chargeForAICall(user2, 'wallet-selfcheck/race-vs-deposit', usageForExactly100Cents, NOW),
      depositMock(user2, 1000),
    ])

    const finalBalance = await prisma.teacher.findUnique({ where: { id: teacher2.id }, select: { balanceCents: true } })

    assert(
      finalBalance?.balanceCents === 950 || finalBalance?.balanceCents === 1000,
      `chargeForAICall vs depositMock: deposit is never lost — balance is 950 or 1000, got ${finalBalance?.balanceCents}`,
    )

    // The two possible interleavings are each internally consistent: if the
    // charge fully succeeded (shortfall 0), the deposit's +1000 must have
    // landed first (50+1000-100=950); if the charge came up short
    // (shortfall 50, zeroed from 50), the deposit's +1000 must have landed
    // after (0+1000=1000).
    const expectedBalance = chargeResult.shortfallCents === 0 ? 950 : 1000
    assert(
      finalBalance?.balanceCents === expectedBalance,
      `chargeForAICall vs depositMock: final balance (${finalBalance?.balanceCents}) matches the charge outcome (shortfallCents=${chargeResult.shortfallCents} -> expected ${expectedBalance})`,
    )
  } finally {
    await prisma.walletTransaction.deleteMany({ where: { teacherId: teacher2.id } })
    await prisma.vipTransaction.deleteMany({ where: { teacherId: teacher2.id } })
    await prisma.teacher.delete({ where: { id: teacher2.id } })
  }

  // ── purchaseAddon: sufficient balance debits + extends the *Until field;
  // insufficient balance throws and touches nothing ──
  const teacher3 = await prisma.teacher.create({
    data: { name: 'Wallet Selfcheck Addon', email: `wallet-selfcheck-addon-${Date.now()}@example.test`, balanceCents: 500 },
    select: { id: true },
  })
  const user3: WalletUser = { id: teacher3.id, role: 'TEACHER' }

  try {
    const result = await purchaseAddon(user3, 'FEATURED_POSTS', 2, 300)
    assert(result.balanceAfterCents === 200, `purchaseAddon: debits exactly the price (500 - 300 = 200), got ${result.balanceAfterCents}`)

    const row = await prisma.teacher.findUnique({ where: { id: teacher3.id }, select: { balanceCents: true, postsHighlightedUntil: true } })
    assert(row?.balanceCents === 200, `purchaseAddon: balance persisted as 200, got ${row?.balanceCents}`)
    assert(
      !!row?.postsHighlightedUntil && row.postsHighlightedUntil.getTime() > Date.now(),
      'purchaseAddon: postsHighlightedUntil is set in the future',
    )

    let threw = false
    try {
      await purchaseAddon(user3, 'PINNED_LISTING', 1, 500) // only 200c left, needs 500c
    } catch (e) {
      threw = e instanceof InsufficientBalanceError
    }
    assert(threw, 'purchaseAddon: insufficient balance throws InsufficientBalanceError')

    const rowAfterFailedPurchase = await prisma.teacher.findUnique({ where: { id: teacher3.id }, select: { balanceCents: true, pinnedInListUntil: true } })
    assert(rowAfterFailedPurchase?.balanceCents === 200, `purchaseAddon: failed purchase leaves balance untouched at 200, got ${rowAfterFailedPurchase?.balanceCents}`)
    assert(rowAfterFailedPurchase?.pinnedInListUntil === null, 'purchaseAddon: failed purchase never sets pinnedInListUntil')
  } finally {
    await prisma.walletTransaction.deleteMany({ where: { teacherId: teacher3.id } })
    await prisma.teacher.delete({ where: { id: teacher3.id } })
  }

  if (failures > 0) {
    console.error(`wallet.selfcheck: ${failures} check(s) FAILED`)
    process.exit(1)
  }
  console.log('wallet.selfcheck: all checks passed')
}

main()
  .catch(e => {
    console.error('wallet.selfcheck: crashed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
