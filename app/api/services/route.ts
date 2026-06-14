import { prisma } from '@/shared/prisma/prisma'
import { createNotification } from '@/shared/lib/notifications'
import { tplPersonalService } from '@/shared/lib/notificationTemplates'
import { localizeService, enrichServiceWithAI } from '@/lib/postAI'
import { hasAIProvider } from '@/lib/openrouter'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get('teacherId')
  const lang = searchParams.get('lang') ?? 'ru'

  if (!teacherId) {
    return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
  }

  try {
    const session = await auth()
    const viewerId = session?.user?.id ?? null
    const isOwner = viewerId === teacherId

    const [services, teacher] = await Promise.all([
      prisma.service.findMany({
        where: {
          teacherId,
          // Personal services: only visible to the target student or to the owner
          OR: [
            { isPersonal: false },
            { isPersonal: true, targetStudentId: null },
            ...(isOwner ? [{ isPersonal: true }] : []),
            ...(viewerId && !isOwner ? [{ isPersonal: true, targetStudentId: viewerId }] : []),
          ],
        },
        include: {
          category: { include: { translations: true } },
          promoCodes: true,
          targetStudent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { langCode: true } }),
    ])

    const localized = services.map((s) => {
      const originalLangCode = (s as any).originalLang ?? teacher?.langCode ?? 'ru'
      return {
        ...localizeService(s, lang),
        originalLangCode,
        isTranslated: !!(s.titleTranslations) && lang !== originalLangCode,
        isPersonal: s.isPersonal,
        isPersonalForMe: s.isPersonal && s.targetStudentId === viewerId,
      }
    })

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
      currency,
    } = body

    if (!title || !duration || !timeFrom || !timeTo || price == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const originalLang = cookieStore.get('NEXT_LOCALE')?.value ?? 'ru'

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
        currency: currency ?? 'BYN',
        isPersonal: Boolean(isPersonal),
        targetStudentId: (isPersonal && targetStudentId) ? targetStudentId : null,
        originalLang,
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

    if (hasAIProvider()) {
      enrichServiceWithAI(service.id).catch((e) => console.error('[serviceAI]', e))
    }

    if (isPersonal && targetStudentId) {
      const svcCurrency: string = body.currency ?? 'BYN'
      const CURRENCY_SYMBOLS: Record<string, string> = {
        RUB: '₽', EUR: '€', USD: '$', BYN: 'Br', GBP: '£', UAH: '₴', KZT: '₸',
      }
      const sym = CURRENCY_SYMBOLS[svcCurrency] ?? svcCurrency
      await createNotification({
        type: 'PERSONAL_SERVICE',
        ...tplPersonalService(title, Number(price), sym),
        payload: {
          serviceId: service.id,
          serviceTitle: title,
          price: Number(price),
          currency: svcCurrency,
        },
        studentId: targetStudentId,
      })
    }

    return NextResponse.json({ service }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
