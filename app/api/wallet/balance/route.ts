import { prisma } from '@/shared/prisma/prisma'
import { getBalanceCents, getWalletSessionUser } from '@/shared/lib/wallet/wallet'
import { NextResponse } from 'next/server'

// GET /api/wallet/balance — current user's balance + VIP status, strictly
// from the session (R11.2 — no id ever accepted from the caller).
export async function GET() {
  try {
    const user = await getWalletSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [balanceCents, vipRow] = await Promise.all([
      getBalanceCents(user),
      user.role === 'TEACHER'
        ? prisma.teacher.findUnique({ where: { id: user.id }, select: { isVip: true, vipExpiresAt: true } })
        : prisma.student.findUnique({ where: { id: user.id }, select: { isVip: true, vipExpiresAt: true } }),
    ])

    const isVip = vipRow?.isVip === true && (vipRow.vipExpiresAt === null || vipRow.vipExpiresAt > new Date())

    return NextResponse.json({ balanceCents, isVip, vipExpiresAt: vipRow?.vipExpiresAt ?? null })
  } catch (e) {
    console.error('[GET /api/wallet/balance]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
