import { generateOtp, saveOtp, sendOtp, verifyOtp } from '@/shared/api/otp'
import { getIp, limits } from '@/shared/api/rate-limit'
import { tooManyRequests } from '@/shared/api/rate-limit-response'
import { prisma } from '@/shared/prisma/prisma'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../auth'

const sendSchema = z.object({
  step: z.literal('send'),
  userType: z.enum(['Student', 'Teacher']),
})

const verifySchema = z.object({
  step: z.literal('verify'),
  otp: z.string().length(6, 'Code must be 6 characters'),
  newPassword: z.string().min(6, 'Minimum 6 characters'),
  userType: z.enum(['Student', 'Teacher']),
})

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getIp(req)
  const body = await req.json()
  const currentEmail = session.user.email

  // ── SEND ────────────────────────────────────────────────────────────────────
  if (body.step === 'send') {
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const [byIp, byTarget] = await Promise.all([limits.ip(ip), limits.target(currentEmail)])
    if (!byIp || !byTarget) return tooManyRequests()

    const code = generateOtp()
    // OTP is keyed by current email (the identity we know)
    await saveOtp(currentEmail, code)
    await sendOtp(currentEmail, code)

    return NextResponse.json({ ok: true })
  }

  // ── VERIFY ───────────────────────────────────────────────────────────────────
  if (body.step === 'verify') {
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { otp, newPassword, userType } = parsed.data

    const rateLimitOk = await limits.verify(ip)
    if (!rateLimitOk) return tooManyRequests()

    const valid = await verifyOtp(currentEmail, otp)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    if (userType === 'Student') {
      await prisma.student.update({
        where: { email: currentEmail },
        data: { password: hashedPassword },
      })
    } else {
      await prisma.teacher.update({
        where: { email: currentEmail },
        data: { password: hashedPassword },
      })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
}