import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

/** Real admin only (session role ADMIN) — same check as the other /api/admin/* routes. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth()
  return session?.user?.role === 'ADMIN' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
