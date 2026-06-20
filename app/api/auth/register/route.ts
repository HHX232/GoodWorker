import { generateOtp, saveOtp, sendOtp, verifyOtp } from '@/shared/api/otp'
import { getIp, limits } from '@/shared/api/rate-limit'
import { tooManyRequests } from '@/shared/api/rate-limit-response'
import { prisma } from '@/shared/prisma/prisma'
import { applyPromoCode } from '@/lib/applyPromoCode'
import { hasCyrillic, transliterateCyrillicToLatin } from '@/shared/lib/transliterate'
import { refineNameTransliterationWithAI } from '@/lib/postAI'
import { hasAIProvider } from '@/lib/openrouter'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const sendUserSchema = z
  .object({
    step: z.literal('send'),
    name: z.string({ error: 'Name is required' }).min(1, 'Name is required').default(''),
    email: z.string({ error: 'Invalid email' }).email('Invalid email').min(1, 'Email is required'),
    phone: z
  .string()
  .transform((v) => (v?.trim() === '' ? null : v))
  .pipe(z.string().min(7, 'Minimum 7 characters').nullable())
  .optional()
  .nullable(),
    password: z.string({ error: 'Minimum 6 characters' }).min(6, 'Minimum 6 characters').default(''),
    langCode: z.string().default('ru')
  })
  
  const sendTeacherSchema = z.object({
    step: z.literal('send'),
    name: z.string({ error: 'Name is required' }).min(1, 'Name is required').default(''),
    email: z.string({ error: 'Invalid email' }).email('Invalid email').min(1, 'Email is required'),
    phone: z
  .string()
  .transform((v) => (v?.trim() === '' ? null : v))
  .pipe(z.string().min(7, 'Minimum 7 characters').nullable())
  .optional()
  .nullable(),
    password: z.string({ error: 'Minimum 6 characters' }).min(6, 'Minimum 6 characters').default(''),
    langCode: z.string().default('ru'),
    categoryIds: z.array(z.string()).min(1, 'At least one category is required').default([]),
    languages: z.array(z.string()).default(['ru'])
  })

  const verifySchema = z.object({
    step: z.literal('verify'),
    otp: z.string().min(6, 'Code must be 6 characters').max(6, 'Code must be 6 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string({ error: 'Name is required' }).min(1, 'Name is required'),
    email: z.string({ error: 'Invalid email' }).email('Invalid email'),
    phone: z.string({ error: 'Minimum 7 characters' }).optional()
  })

  export async function POST(req: NextRequest) {
     const ip = getIp(req)
  const body = await req.json()
  if(body.step === 'send' && body.userType === 'Teacher'){
   const parsed = sendTeacherSchema.safeParse(body)
   if(!parsed.success){
    return Response.json({ error: parsed.error.message }, { status: 400 })
   }
   const {  email} = parsed.data

    const [byIp, byTarget] = await Promise.all([
      limits.ip(ip),
      limits.target(email),
    ])
    if (!byIp || !byTarget) {
      return tooManyRequests()
    }

    const existing = await prisma.teacher.findUnique({
      where: { email }
    })

    if (existing) {
      return Response.json({ error: 'Server error' }, { status: 500 })
    }
    const code = generateOtp()
    await saveOtp(email, code)
    await sendOtp(email, code)

    return NextResponse.json({ ok: true })

  }
   if(body.step === 'send' && body.userType === 'User'){
   const parsed = sendUserSchema.safeParse(body)
   if(!parsed.success){
    return Response.json({ error: parsed.error.message }, { status: 400 })
   }
   const { email } = parsed.data
   
    const [byIp, byTarget] = await Promise.all([
      limits.ip(ip),
      limits.target(email),
    ])
    if (!byIp || !byTarget) {
      return tooManyRequests()
    }

    const existing = await prisma.student.findUnique({
      where: { email }
    })

    if (existing) {
      return Response.json({ error: 'Server error' }, { status: 500 })
    }
    const code = generateOtp()
    await saveOtp(email, code)
    await sendOtp(email, code)

    return NextResponse.json({ ok: true })

  }

  if (body.step === 'verify') {
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, email, phone, password, otp } = parsed.data

  const rateLimitSuccess = await limits.verify(ip)
  if (!rateLimitSuccess) return tooManyRequests()

  const valid = await verifyOtp(email, otp)
  if (!valid) {
    return NextResponse.json({ error: 'Неверный или истёкший код' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const nameTransliterated = hasCyrillic(name) ? transliterateCyrillicToLatin(name) : null

  try {
    let user

    if (body.userType === 'User') {
      user = await prisma.student.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          langCode: body.langCode ?? 'ru',
          nameTransliterated,
        },
        select: { id: true, name: true, email: true, phone: true },
      })
    } else if (body.userType === 'Teacher') {
      user = await prisma.teacher.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          langCode: body.langCode ?? 'ru',
          nameTransliterated,
          languages: Array.isArray(body.languages) && body.languages.length > 0
            ? body.languages
            : ['ru'],
          categories: {
            create: (body.categoryIds as string[]).map((categoryId: string) => ({
              categoryId,
            })),
          },
        },
        select: { id: true, name: true, email: true, phone: true },
      })
    } else {
      return NextResponse.json({ error: 'Неверный userType' }, { status: 400 })
    }

    // Build full multi-locale transliteration via AI in background (non-blocking)
    if (user && hasAIProvider()) {
      const userType = body.userType === 'Teacher' ? 'teacher' : 'student'
      refineNameTransliterationWithAI(name, user.id, userType).catch(() => {})
    }

    // Apply promo code silently if provided — registration always succeeds regardless
    const promoCode: string | undefined = body.promoCode?.trim()
    let promoResult = null
    if (promoCode && user) {
      const userRole = body.userType === 'Teacher' ? 'TEACHER' : 'STUDENT'
      promoResult = await applyPromoCode(user.id, userRole, promoCode).catch(() => null)
    }

    return NextResponse.json({ ...user, promoResult }, { status: 201 })

  } catch (e) {
    console.error('VERIFY ERROR:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


    return NextResponse.json({ error: 'Неверный step' }, { status: 400 })

  }