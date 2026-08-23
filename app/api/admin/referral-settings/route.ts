import { prisma } from '@/shared/prisma/prisma'
import { getReferralSettings } from '@/lib/referralCode'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await getReferralSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('[GET /api/admin/referral-settings]', error)
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
    const rewardDays = Number(body.rewardDays)
    const maxFreeInvites = Number(body.maxFreeInvites)

    if (!Number.isInteger(rewardDays) || rewardDays < 1) {
      return NextResponse.json({ error: 'rewardDays must be a positive integer' }, { status: 400 })
    }
    // maxFreeInvites: 0 means unlimited
    if (!Number.isInteger(maxFreeInvites) || maxFreeInvites < 0) {
      return NextResponse.json({ error: 'maxFreeInvites must be 0 (unlimited) or a positive integer' }, { status: 400 })
    }

    const settings = await prisma.referralSettings.upsert({
      where: { id: 'global' },
      update: { rewardDays, maxFreeInvites },
      create: { id: 'global', rewardDays, maxFreeInvites },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('[PATCH /api/admin/referral-settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
