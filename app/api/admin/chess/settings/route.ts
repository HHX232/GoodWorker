import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { getVipRewards, parseVipRewards, saveVipRewards, VIP_ALLOWED_CODES, VIP_DAYS_MAX } from '@/shared/lib/chess/server/progress'

// GET /api/admin/chess/settings → {vipRewards: {code: days}, allowed: code[], maxDays}
// Only the allowed badges are listed (points_*, streak_*); 0 = no VIP for that badge.
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const table = await getVipRewards()
    const vipRewards = Object.fromEntries(VIP_ALLOWED_CODES.map((c) => [c, table[c] ?? 0]))
    return NextResponse.json({ vipRewards, allowed: VIP_ALLOWED_CODES, maxDays: VIP_DAYS_MAX })
  } catch (e) {
    console.error('[GET /api/admin/chess/settings]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/admin/chess/settings {vipRewards: {code: 0..365}} → {ok, vipRewards} · 400 {error:'BAD_INPUT'} · 403
// A badge not in the allowed list (online_first_win, storm_*, first_win_*) is rejected: VIP only for capped badges.
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const table = parseVipRewards(body?.vipRewards)
    if (!table) return NextResponse.json({ error: 'BAD_INPUT' }, { status: 400 })
    await saveVipRewards(table)
    return NextResponse.json({ ok: true, vipRewards: table })
  } catch (e) {
    console.error('[PATCH /api/admin/chess/settings]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
