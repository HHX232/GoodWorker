import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const STUDENT_EMAIL = 'student@seed.dev'
const PASSWORD = 'password123'
const ADMIN_EMAILS = [TEACHER_EMAIL]

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10)

  const category = await prisma.category.findFirst({where: {levelNumber: 2}})

  const teacher = await prisma.teacher.upsert({
    where: {email: TEACHER_EMAIL},
    update: {},
    create: {
      name: 'Иван Петров',
      email: TEACHER_EMAIL,
      password: hash,
      langCode: 'ru',
      avatarUrl: 'https://i.pravatar.cc/150?u=teacher-seed',
      ...(category
        ? {categories: {create: [{categoryId: category.id}]}}
        : {}),
    },
  })
  console.log('✅ Teacher:', teacher.id, teacher.email)

  const student = await prisma.student.upsert({
    where: {email: STUDENT_EMAIL},
    update: {},
    create: {
      name: 'Алиса Смирнова',
      email: STUDENT_EMAIL,
      password: hash,
      langCode: 'ru',
      avatarUrl: 'https://i.pravatar.cc/150?u=student-seed',
    },
  })
  console.log('✅ Student:', student.id, student.email)

  await prisma.teacherStudent.upsert({
    where: {teacherId_studentId: {teacherId: teacher.id, studentId: student.id}},
    update: {},
    create: {teacherId: teacher.id, studentId: student.id},
  })

  const now = new Date()
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000)

  const notifications = [
    {
      type: 'NEW_STUDENT',
      title: 'Новый ученик',
      body: 'Алиса Смирнова подписалась на вас',
      payload: {studentId: student.id, studentName: student.name},
      createdAt: ago(1),
    },
    {
      type: 'NEW_COMMENT_ON_POST',
      title: 'Новый комментарий',
      body: 'Алиса оставила комментарий к вашему посту «Введение в Python»',
      payload: {postId: 'seed-post-1', postTitle: 'Введение в Python', authorName: student.name},
      createdAt: ago(3),
    },
    {
      type: 'NEW_REVIEW',
      title: 'Новый отзыв',
      body: 'Алиса Смирнова оставила отзыв на роадмап и поставила 5 звёзд',
      payload: {roadmapId: 'seed-roadmap-1', stars: 5, authorName: student.name},
      createdAt: ago(8),
    },
    {
      type: 'ROADMAP_PURCHASE',
      title: 'Покупка роадмапа',
      body: 'Алиса Смирнова купила роадмап «Python с нуля до джуна»',
      payload: {roadmapId: 'seed-roadmap-1', roadmapTitle: 'Python с нуля до джуна', amount: 990},
      createdAt: ago(24),
    },
    {
      type: 'SYSTEM',
      title: 'Добро пожаловать!',
      body: 'Ваш аккаунт успешно верифицирован. Начните создавать посты и роадмапы.',
      payload: null,
      createdAt: ago(48),
    },
  ]

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload ?? undefined,
        isRead: false,
        teacherId: teacher.id,
        createdAt: n.createdAt,
      },
    })
  }
  console.log(`✅ ${notifications.length} notifications created for teacher`)

  // ── Receipts (service bookings) demo data for the "моя статистика" page ──
  const service1 = await prisma.service.upsert({
    where: {id: 'seed-service-math'},
    update: {},
    create: {
      id: 'seed-service-math',
      teacherId: teacher.id,
      title: 'Математика (индивидуально)',
      duration: 60,
      timeFrom: '10:00',
      timeTo: '20:00',
      price: 40,
      currency: 'BYN',
    },
  })
  const service2 = await prisma.service.upsert({
    where: {id: 'seed-service-physics'},
    update: {},
    create: {
      id: 'seed-service-physics',
      teacherId: teacher.id,
      title: 'Подготовка к ЦТ по физике',
      duration: 90,
      timeFrom: '10:00',
      timeTo: '20:00',
      price: 55,
      currency: 'BYN',
    },
  })

  const dateStr = (daysOffset: number) => {
    const d = new Date(now.getTime() + daysOffset * 86_400_000)
    return d.toISOString().slice(0, 10)
  }

  const receiptBookings: {
    id: string; serviceId: string; finalPrice: number; daysOffset: number; paid: boolean
  }[] = [
    {id: 'seed-booking-1', serviceId: service1.id, finalPrice: 40, daysOffset: -35, paid: true},
    {id: 'seed-booking-2', serviceId: service1.id, finalPrice: 40, daysOffset: -21, paid: true},
    {id: 'seed-booking-3', serviceId: service2.id, finalPrice: 55, daysOffset: -14, paid: true},
    {id: 'seed-booking-4', serviceId: service1.id, finalPrice: 40, daysOffset: -7, paid: false},
    {id: 'seed-booking-5', serviceId: service2.id, finalPrice: 55, daysOffset: -2, paid: false},
    {id: 'seed-booking-6', serviceId: service1.id, finalPrice: 40, daysOffset: 5, paid: false},
    {id: 'seed-booking-7', serviceId: service2.id, finalPrice: 55, daysOffset: 18, paid: false},
  ]

  for (const b of receiptBookings) {
    await prisma.serviceBooking.upsert({
      where: {id: b.id},
      update: {},
      create: {
        id: b.id,
        serviceId: b.serviceId,
        studentId: student.id,
        status: 'CONFIRMED',
        finalPrice: b.finalPrice,
        confirmedDate: dateStr(b.daysOffset),
        confirmedTime: '16:00',
        paidAt: b.paid ? ago(Math.abs(b.daysOffset) * 24 - 1) : null,
      },
    })
  }
  console.log(`✅ ${receiptBookings.length} demo service bookings (receipts) created`)

  // ── AdminEmail whitelist ─────────────────────────────────
  for (const email of ADMIN_EMAILS) {
    await prisma.adminEmail.upsert({
      where: { email },
      update: {},
      create: { email },
    })
  }
  console.log(`✅ Admin emails seeded: ${ADMIN_EMAILS.join(', ')}`)

  console.log('\n--- Seed credentials ---')
  console.log(`Teacher (admin): ${TEACHER_EMAIL} / ${PASSWORD}`)
  console.log(`Student: ${STUDENT_EMAIL} / ${PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
