import { generateOtp, saveOtp, sendOtp, verifyOtp } from '@/shared/api/otp'
import { getIp, limits } from '@/shared/api/rate-limit'
import { tooManyRequests } from '@/shared/api/rate-limit-response'
import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '../../../../../auth'

const sendSchema = z.object({
  step: z.literal('send'),
  newEmail: z.string().email('Invalid email'),
  userType: z.enum(['Student', 'Teacher']),
})

const verifySchema = z.object({
  step: z.literal('verify'),
  newEmail: z.string().email('Invalid email'),
  otp: z.string().length(6, 'Code must be 6 characters'),
  userType: z.enum(['Student', 'Teacher']),
})

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getIp(req)
  const body = await req.json()

  // ── SEND ────────────────────────────────────────────────────────────────────
  if (body.step === 'send') {
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { newEmail, userType } = parsed.data

    const [byIp, byTarget] = await Promise.all([limits.ip(ip), limits.target(newEmail)])
    if (!byIp || !byTarget) return tooManyRequests()

    // Check new email is not already taken
    const model = userType === 'Student' ? prisma.student : prisma.teacher
    const existing = await (model as typeof prisma.student).findUnique({ where: { email: newEmail } })

    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const code = generateOtp()
    await saveOtp(newEmail, code)
    await sendOtp(newEmail, code)

    return NextResponse.json({ ok: true })
  }

  // ── VERIFY ───────────────────────────────────────────────────────────────────
  if (body.step === 'verify') {
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { newEmail, otp, userType } = parsed.data

    const rateLimitOk = await limits.verify(ip)
    if (!rateLimitOk) return tooManyRequests()

    const valid = await verifyOtp(newEmail, otp)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    if (userType === 'Student') {
      await prisma.student.update({
        where: { email: session.user.email },
        data: { email: newEmail },
      })
    } else {
      await prisma.teacher.update({
        where: { email: session.user.email },
        data: { email: newEmail },
      })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
}