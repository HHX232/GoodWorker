// Self-check for wallet.ts's chargeStorageOverage — run with
// `npx tsx src/shared/lib/wallet/storage-overage.selfcheck.ts` against the
// real dev DB (DATABASE_URL from .env). No test runner in this project.
// Creates and tears down its own throwaway Teacher rows — does not touch
// seed accounts. Separate file from wallet.selfcheck.ts per the ticket:
// don't rewrite an existing selfcheck, add a new one for the new seam.
import { prisma } from '@/shared/prisma/prisma'
import { chargeStorageOverage } from './wallet'

let failures = 0
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++
    console.error(`FAIL ${label}`)
  } else {
    console.log(`PASS ${label}`)
  }
}

const NOW = new Date('2026-09-19T12:00:00Z')

async function main() {
  // ── Ordinary charge: balance covers the full overage ──
  const teacher = await prisma.teacher.create({
    data: { name: 'Storage Overage Selfcheck', email: `storage-overage-selfcheck-${Date.now()}@example.test`, balanceCents: 1000 },
    select: { id: true },
  })

  try {
    // 3 GB over quota at 150c/GB = 450c.
    const result = await chargeStorageOverage(teacher.id, 3, 150, NOW)
    assert(result.costCents === 450, `chargeStorageOverage: costCents is overageGb * priceCentsPerGb (3 * 150 = 450), got ${result.costCents}`)
    assert(result.shortfallCents === 0, `chargeStorageOverage: sufficient balance leaves shortfallCents at 0, got ${result.shortfallCents}`)
    assert(result.balanceAfterCents === 550, `chargeStorageOverage: balance debited exactly (1000 - 450 = 550), got ${result.balanceAfterCents}`)

    const row = await prisma.teacher.findUnique({ where: { id: teacher.id }, select: { balanceCents: true } })
    assert(row?.balanceCents === 550, `chargeStorageOverage: debit persisted to the DB (550), got ${row?.balanceCents}`)

    const tx = await prisma.walletTransaction.findFirst({ where: { teacherId: teacher.id, type: 'STORAGE_OVERAGE_DEBIT' } })
    assert(!!tx, 'chargeStorageOverage: writes a STORAGE_OVERAGE_DEBIT ledger row')
    assert(tx?.balanceAfterCents === 550, `chargeStorageOverage: ledger row balanceAfterCents matches (550), got ${tx?.balanceAfterCents}`)
    assert(tx?.amountCents === 450, `chargeStorageOverage: ledger row amountCents matches the cost (450), got ${tx?.amountCents}`)
    assert(tx?.shortfallCents === null, 'chargeStorageOverage: ordinary charge records no shortfallCents')
  } finally {
    await prisma.walletTransaction.deleteMany({ where: { teacherId: teacher.id } })
    await prisma.teacher.delete({ where: { id: teacher.id } })
  }

  // ── Zero-floor: balance doesn't cover the full overage — charges what's
  // there, ends at 0, never throws, still writes the ledger row ──
  const teacher2 = await prisma.teacher.create({
    data: { name: 'Storage Overage Selfcheck Zero-Floor', email: `storage-overage-selfcheck-zf-${Date.now()}@example.test`, balanceCents: 100 },
    select: { id: true },
  })

  try {
    // 5 GB over quota at 150c/GB = 750c needed, only 100c available.
    let threw = false
    let result
    try {
      result = await chargeStorageOverage(teacher2.id, 5, 150, NOW)
    } catch {
      threw = true
    }
    assert(!threw, 'chargeStorageOverage: insufficient balance never throws (cron has no one to show an error to)')
    assert(result?.balanceAfterCents === 0, `chargeStorageOverage: zero-floor ends the balance at exactly 0, got ${result?.balanceAfterCents}`)
    assert(result?.shortfallCents === 650, `chargeStorageOverage: shortfallCents is the uncovered remainder (750 - 100 = 650), got ${result?.shortfallCents}`)

    const row = await prisma.teacher.findUnique({ where: { id: teacher2.id }, select: { balanceCents: true } })
    assert(row?.balanceCents === 0, `chargeStorageOverage: zero-floor persisted to the DB (0), got ${row?.balanceCents}`)

    const tx = await prisma.walletTransaction.findFirst({ where: { teacherId: teacher2.id, type: 'STORAGE_OVERAGE_DEBIT' } })
    assert(!!tx, 'chargeStorageOverage: zero-floor still writes a STORAGE_OVERAGE_DEBIT ledger row')
    assert(tx?.amountCents === 750, `chargeStorageOverage: ledger row still records the full intended cost (750), got ${tx?.amountCents}`)
    assert(tx?.shortfallCents === 650, `chargeStorageOverage: ledger row records the shortfall (650), got ${tx?.shortfallCents}`)
  } finally {
    await prisma.walletTransaction.deleteMany({ where: { teacherId: teacher2.id } })
    await prisma.teacher.delete({ where: { id: teacher2.id } })
  }

  // ── priceCentsPerGb of 0 (admin hasn't set a price) is a no-op: no charge,
  // no ledger row ──
  const teacher3 = await prisma.teacher.create({
    data: { name: 'Storage Overage Selfcheck Zero-Price', email: `storage-overage-selfcheck-zp-${Date.now()}@example.test`, balanceCents: 100 },
    select: { id: true },
  })

  try {
    const result = await chargeStorageOverage(teacher3.id, 5, 0, NOW)
    assert(result.costCents === 0, `chargeStorageOverage: priceCentsPerGb=0 computes to 0 cost, got ${result.costCents}`)
    assert(result.balanceAfterCents === 100, `chargeStorageOverage: priceCentsPerGb=0 leaves the balance untouched (100), got ${result.balanceAfterCents}`)

    const tx = await prisma.walletTransaction.findFirst({ where: { teacherId: teacher3.id, type: 'STORAGE_OVERAGE_DEBIT' } })
    assert(!tx, 'chargeStorageOverage: priceCentsPerGb=0 writes no ledger row')
  } finally {
    await prisma.teacher.delete({ where: { id: teacher3.id } })
  }

  if (failures > 0) {
    console.error(`storage-overage.selfcheck: ${failures} check(s) FAILED`)
    process.exit(1)
  }
  console.log('storage-overage.selfcheck: all checks passed')
}

main()
  .catch(e => {
    console.error('storage-overage.selfcheck: crashed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
