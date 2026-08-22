import { langFromRequest } from '@/features/helpers/langCodeFromHeader'
import { generateOtp, saveOtp, sendOtp, verifyOtp } from '@/shared/api/otp'
import { getIp, limits } from '@/shared/api/rate-limit'
import { tooManyRequests } from '@/shared/api/rate-limit-response'
import { prisma } from '@/shared/prisma/prisma'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const sendSchema = z.object({
  step: z.literal('send'),
  email: z.string().email('Invalid email'),
})

const verifySchema = z.object({
  step: z.literal('verify'),
  email: z.string().email('Invalid email'),
  otp: z.string().length(6, 'Code must be 6 characters'),
  newPassword: z.string().min(6, 'Minimum 6 characters'),
})

const ERROR_MESSAGES = {
  invalidCode: {
    ru: 'Неверный или истёкший код',
    en: 'Invalid or expired code',
    zh: '验证码无效或已过期',
    hi: 'गलत या समाप्त हो चुका कोड',
  },
  accountNotFound: {
    ru: 'Аккаунт с таким email не найден',
    en: 'No account found with this email',
    zh: '未找到该邮箱对应的账户',
    hi: 'इस ईमेल से कोई खाता नहीं मिला',
  },
} as const

function errorMessage(key: keyof typeof ERROR_MESSAGES, lang: string) {
  return ERROR_MESSAGES[key][lang as keyof typeof ERROR_MESSAGES[typeof key]] ?? ERROR_MESSAGES[key].ru
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const lang = langFromRequest(req)
  const body = await req.json()

  // ── SEND ─────────────────────────────────────────────────────────────────
  if (body.step === 'send') {
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { email } = parsed.data

    const [byIp, byTarget] = await Promise.all([limits.ip(ip), limits.target(email)])
    if (!byIp || !byTarget) return tooManyRequests()

    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { email }, select: { id: true } }),
      prisma.teacher.findUnique({ where: { email }, select: { id: true } }),
    ])

    // Always respond the same way whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    if (student || teacher) {
      const code = generateOtp()
      await saveOtp(email, code)
      await sendOtp(email, code, lang)
    }

    return NextResponse.json({ ok: true })
  }

  // ── VERIFY ───────────────────────────────────────────────────────────────
  if (body.step === 'verify') {
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { email, otp, newPassword } = parsed.data

    const rateLimitOk = await limits.verify(ip)
    if (!rateLimitOk) return tooManyRequests()

    const valid = await verifyOtp(email, otp)
    if (!valid) {
      return NextResponse.json({ error: errorMessage('invalidCode', lang) }, { status: 400 })
    }

    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { email }, select: { id: true } }),
      prisma.teacher.findUnique({ where: { email }, select: { id: true } }),
    ])

    if (!student && !teacher) {
      return NextResponse.json({ error: errorMessage('accountNotFound', lang) }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    if (student) {
      await prisma.student.update({ where: { email }, data: { password: hashedPassword } })
    } else {
      await prisma.teacher.update({ where: { email }, data: { password: hashedPassword } })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
}
