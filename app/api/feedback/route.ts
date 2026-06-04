import { prisma } from '@/shared/prisma/prisma'
import { createNotification } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { text, subject, photoUrl } = body

    if (!text?.trim()) return NextResponse.json({ error: 'Text required' }, { status: 400 })

    const fullText = subject?.trim() ? `[${subject.trim()}]\n${text.trim()}` : text.trim()

    const prevCount = await prisma.complaint.count({
      where: { reporterId: session.user.id, targetType: 'PLATFORM' },
    })

    const complaint = await prisma.complaint.create({
      data: {
        reporterId: session.user.id,
        reporterRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        targetType: 'PLATFORM',
        targetId: 'platform',
        text: fullText,
        status: 'pending',
        ...(photoUrl ? { photoUrl } : {}),
      },
    })

    if (prevCount === 0) {
      let code = generateCode()
      let attempts = 0
      while (attempts < 5) {
        const exists = await prisma.promoCode.findUnique({ where: { code } })
        if (!exists) break
        code = generateCode()
        attempts++
      }

      await prisma.promoCode.create({
        data: {
          code,
          rewardType: 'FREE_VIP',
          vipDays: 7,
          description: 'Бонус за первую обратную связь',
          maxUses: null,
          isActive: true,
        },
      })

      const isTeacher = (session.user.role === 'TEACHER' || session.user.role === 'ADMIN')
      await createNotification({
        type: 'SYSTEM',
        title: 'Спасибо за обратную связь!',
        body: `Вы получили промокод за первый отзыв: ${code}`,
        payload: {
          promoCode: code,
          promoDays: 7,
        },
        ...(isTeacher ? { teacherId: session.user.id } : { studentId: session.user.id }),
      })
    }

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('[POST /api/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await prisma.complaint.findMany({
      where: { reporterId: session.user.id, targetType: 'PLATFORM' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        text: true,
        status: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[GET /api/feedback]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
