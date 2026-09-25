import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const DAYS = 30

// GET /api/admin/wallet-analytics — admin-only. Daily AI_DEBIT breakdown for
// the last 30 days (what was charged vs. real DeepSeek cost vs. tokens), plus
// an all-time total. `rawCostCents`/`totalTokens` only exist on rows written
// after that migration (see WalletTransaction comment in schema.prisma) — the
// "tracked" totals silently exclude older rows rather than under/over-
// counting with a guess, and `trackingSince` tells the caller where the real
// data starts so the UI can say so instead of implying full history.
export async function GET() {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const since = new Date()
    since.setDate(since.getDate() - (DAYS - 1))
    since.setHours(0, 0, 0, 0)

    const rows = await prisma.walletTransaction.findMany({
      where: { type: 'AI_DEBIT', createdAt: { gte: since } },
      select: { amountCents: true, rawCostCents: true, totalTokens: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay = new Map<string, { chargedCents: number; costCents: number; tokens: number }>()
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since)
      d.setDate(d.getDate() + i)
      byDay.set(d.toISOString().slice(0, 10), { chargedCents: 0, costCents: 0, tokens: 0 })
    }

    let costCentsTracked = 0
    let tokensTracked = 0
    let trackingSince: string | null = null

    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10)
      const bucket = byDay.get(key)
      if (bucket) bucket.chargedCents += row.amountCents
      if (row.rawCostCents !== null) {
        if (bucket) bucket.costCents += row.rawCostCents
        costCentsTracked += row.rawCostCents
        if (!trackingSince || row.createdAt.toISOString() < trackingSince) trackingSince = row.createdAt.toISOString()
      }
      if (row.totalTokens !== null) {
        if (bucket) bucket.tokens += row.totalTokens
        tokensTracked += row.totalTokens
      }
    }

    const chargedCentsAllTime = await prisma.walletTransaction.aggregate({
      where: { type: 'AI_DEBIT' },
      _sum: { amountCents: true },
    })

    const days = Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v }))

    return NextResponse.json({
      days,
      totals: {
        chargedCentsAllTime: chargedCentsAllTime._sum.amountCents ?? 0,
        costCentsTracked,
        tokensTracked,
        trackingSince,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/wallet-analytics]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
