import { resolveVip } from '@/lib/vipStatus'
import { NextResponse } from 'next/server'
import { auth } from '../../../auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ isVip: false })

  const isVip = await resolveVip(session.user.email)
  return NextResponse.json({ isVip })
}
