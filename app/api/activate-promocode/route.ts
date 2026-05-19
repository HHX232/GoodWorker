import { applyPromoCode } from '@/lib/applyPromoCode'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = session?.user?.role
    const userId = session?.user?.id

    if (!userId || (role !== 'TEACHER' && role !== 'ADMIN' && role !== 'STUDENT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const rawCode: string = body.code ?? ''
    if (!rawCode.trim()) {
      return NextResponse.json({ error: 'INVALID_PROMO' }, { status: 400 })
    }

    const result = await applyPromoCode(userId, role as 'TEACHER' | 'STUDENT', rawCode)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, vipUntil: result.vipUntil, description: result.description })
  } catch (error) {
    console.error('[POST /api/activate-promocode]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
