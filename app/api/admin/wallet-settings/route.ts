import { getMarkupPercent, setMarkupPercent } from '@/shared/lib/wallet/wallet'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const MIN_MARKUP_PERCENT = 0
const MAX_MARKUP_PERCENT = 500

export async function GET() {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const markupPercent = await getMarkupPercent()
    return NextResponse.json({ markupPercent })
  } catch (error) {
    console.error('[GET /api/admin/wallet-settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const markupPercent = Number(body.markupPercent)

    if (!Number.isInteger(markupPercent) || markupPercent < MIN_MARKUP_PERCENT || markupPercent > MAX_MARKUP_PERCENT) {
      return NextResponse.json(
        { error: `markupPercent must be an integer between ${MIN_MARKUP_PERCENT} and ${MAX_MARKUP_PERCENT}` },
        { status: 400 },
      )
    }

    await setMarkupPercent(markupPercent)
    return NextResponse.json({ markupPercent })
  } catch (error) {
    console.error('[PATCH /api/admin/wallet-settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
