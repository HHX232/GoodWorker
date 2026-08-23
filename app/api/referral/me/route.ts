import { prisma } from '@/shared/prisma/prisma'
import { getOrCreateReferralCode, getReferralSettings } from '@/lib/referralCode'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const APP_URL = 'https://goodworker.up.railway.app'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Admin accounts are Teacher rows under the hood (see auth.ts) — their VIP/referral
    // fields live on the Teacher table just like any other teacher.
    const role = session.user.role === 'STUDENT' ? 'STUDENT' : 'TEACHER'

    const [code, settings, invitesUsed] = await Promise.all([
      getOrCreateReferralCode(session.user.id, role),
      getReferralSettings(),
      prisma.referral.count({
        where: role === 'TEACHER'
          ? { referrerTeacherId: session.user.id }
          : { referrerStudentId: session.user.id },
      }),
    ])

    const isUnlimited = settings.maxFreeInvites === 0
    const remaining = isUnlimited ? null : Math.max(0, settings.maxFreeInvites - invitesUsed)

    return NextResponse.json({
      code,
      link: `${APP_URL}/register?ref=${code}`,
      rewardDays: settings.rewardDays,
      maxFreeInvites: settings.maxFreeInvites,
      isUnlimited,
      invitesUsed,
      remaining,
    })
  } catch (error) {
    console.error('[GET /api/referral/me]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
