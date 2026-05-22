import { prisma } from '@/shared/prisma/prisma'
import { createNotification } from '@/shared/lib/notifications'
import { localizeService } from '@/lib/postAI'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { enrichServiceWithAI } from '@/lib/postAI'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get('teacherId')
  const lang = searchParams.get('lang') ?? 'ru'

  if (!teacherId) {
    return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
  }

  try {
    const [services, teacher] = await Promise.all([
      prisma.service.findMany({
        where: { teacherId },
        include: {
          category: { include: { translations: true } },
          promoCodes: true,
          targetStudent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { langCode: true } }),
    ])

    const originalLangCode = teacher?.langCode ?? 'ru'

    const localized = services.map((s) => ({
      ...localizeService(s, lang),
      originalLangCode,
      isTranslated: !!(s.titleTranslations) && lang !== originalLangCode,
    }))

    return NextResponse.json({ services: localized })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      description,
      photoUrl,
      categoryId,
      duration,
      timeFrom,
      timeTo,
      isGroup,
      price,
      promoCode,
      targetStudentId,
      isPersonal,
    } = body

    if (!title || !duration || !timeFrom || !timeTo || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        teacherId: session.user.id,
        title,
        description: description ?? null,
        photoUrl: photoUrl ?? null,
        categoryId: categoryId ?? null,
        duration: Number(duration),
        timeFrom,
        timeTo,
        isGroup: Boolean(isGroup),
        price: Number(price),
        isPersonal: Boolean(isPersonal),
        targetStudentId: (isPersonal && targetStudentId) ? targetStudentId : null,
        ...(promoCode
          ? {
              promoCodes: {
                create: {
                  code: promoCode.code,
                  discount: Number(promoCode.discount),
                  usageLimit: promoCode.usageLimit ? Number(promoCode.usageLimit) : null,
                  conditions: promoCode.conditions ?? null,
                },
              },
            }
          : {}),
      },
      include: {
        category: { include: { translations: true } },
        promoCodes: true,
        targetStudent: { select: { id: true, name: true } },
      },
    })

    if (process.env.OPENROUTER_API_KEY) {
      enrichServiceWithAI(service.id).catch((e) => console.error('[serviceAI]', e))
    }

    if (isPersonal && targetStudentId) {
      await createNotification({
        type: 'SYSTEM',
        title: 'Личная услуга от преподавателя',
        body: `Преподаватель создал для вас личное предложение: «${title}» — ${Number(price)} ₽`,
        studentId: targetStudentId,
      })
    }

    return NextResponse.json({ service }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
