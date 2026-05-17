/**
 * Seed: StudentError records for testing error/correction tracking.
 * References users from seedUsers.ts (teacher@seed.dev / student@seed.dev).
 *
 * Run: DATABASE_URL="..." npx tsx prisma/seedErrors.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const STUDENT_EMAIL = 'student@seed.dev'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000)
}

const ERRORS: Array<{
  description: string
  fragment?: string
  isCorrection: boolean
  categoryNames?: string[]
  daysBack: number
}> = [
  // ── Real errors ───────────────────────────────────────────────────────────
  {
    description: 'Неправильное использование артикля "the" вместо "a" при первом упоминании существительного',
    fragment: 'Ученик сказал: "I saw the dog in the park" при первом упоминании собаки.',
    isCorrection: false,
    categoryNames: ['English', 'Grammar'],
    daysBack: 1,
  },
  {
    description: 'Ошибка в согласовании подлежащего и сказуемого: "He don\'t know"',
    fragment: 'Транскрипт: "He don\'t know the answer to this question."',
    isCorrection: false,
    categoryNames: ['English', 'Grammar'],
    daysBack: 2,
  },
  {
    description: 'Неверное употребление времени: Past Simple вместо Present Perfect',
    fragment: '"Yesterday I did this exercise" — при описании опыта без привязки к дате.',
    isCorrection: false,
    categoryNames: ['English'],
    daysBack: 3,
  },
  {
    description: 'Путаница с предлогами: "in Monday" вместо "on Monday"',
    fragment: 'Ученик: "We have class in Monday and in Wednesday."',
    isCorrection: false,
    categoryNames: ['English', 'Grammar'],
    daysBack: 4,
  },
  {
    description: 'Произношение: неправильное ударение в слове "comfortable"',
    isCorrection: false,
    categoryNames: ['English'],
    daysBack: 5,
  },
  {
    description: 'Ошибка в порядке слов в вопросительном предложении: "Where you are going?"',
    fragment: '"Where you are going after school?" — пропущена инверсия.',
    isCorrection: false,
    categoryNames: ['English', 'Grammar'],
    daysBack: 7,
  },
  {
    description: 'Математическая ошибка: неверное применение формулы дискриминанта',
    fragment: 'При решении квадратного уравнения x²+5x+6=0 ученик записал D = b²+4ac вместо b²-4ac.',
    isCorrection: false,
    categoryNames: ['Math'],
    daysBack: 8,
  },
  {
    description: 'Знаки препинания: запятая перед союзом "и" в простом предложении',
    isCorrection: false,
    daysBack: 10,
  },
  {
    description: 'Неверное использование Conditional II: смешение с Conditional I',
    fragment: '"If it will rain tomorrow, I would stay at home" — смешение двух типов.',
    isCorrection: false,
    categoryNames: ['English', 'Grammar'],
    daysBack: 12,
  },
  {
    description: 'Ошибка в произношении числа 13 и 30 (thirteen / thirty)',
    isCorrection: false,
    categoryNames: ['English'],
    daysBack: 14,
  },

  // ── Corrections (student self-corrected) ──────────────────────────────────
  {
    description: 'Исправил ошибку с артиклем: самостоятельно заменил "a" на "an" перед гласным',
    fragment: 'Ученик сначала сказал "a apple", затем тут же поправился: "an apple, sorry".',
    isCorrection: true,
    categoryNames: ['English', 'Grammar'],
    daysBack: 1,
  },
  {
    description: 'Исправил время: заменил Past Simple на Present Perfect после подсказки контекстом',
    fragment: 'Сначала: "I finished the book yesterday" — после переформулировки вопроса: "I have already finished it".',
    isCorrection: true,
    categoryNames: ['English'],
    daysBack: 3,
  },
  {
    description: 'Самостоятельно исправил порядок слов в вопросе',
    fragment: '"Where are you going?" — поправил без подсказки учителя.',
    isCorrection: true,
    categoryNames: ['English', 'Grammar'],
    daysBack: 7,
  },
  {
    description: 'Исправил формулу дискриминанта после пересчёта',
    fragment: 'После получения отрицательного ответа пересчитал и нашёл ошибку знака.',
    isCorrection: true,
    categoryNames: ['Math'],
    daysBack: 8,
  },
  {
    description: 'Исправил предлог "in Monday" → "on Monday" при повторном использовании',
    isCorrection: true,
    categoryNames: ['English'],
    daysBack: 10,
  },
]

async function main() {
  const teacher = await prisma.teacher.findUnique({ where: { email: TEACHER_EMAIL } })
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}. Run seedUsers.ts first.`)

  const student = await prisma.student.findUnique({ where: { email: STUDENT_EMAIL } })
  if (!student) throw new Error(`Student not found: ${STUDENT_EMAIL}. Run seedUsers.ts first.`)

  // Find a real conference for sourceId (or fall back to a placeholder)
  const conference = await prisma.conference.findFirst({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
  })
  const sourceId = conference?.id ?? 'seed-source-call-1'

  // Collect all categories for matching by name
  const allCategories = await prisma.category.findMany({
    include: { translations: true },
  })

  function findCategoryId(name: string): string | null {
    const lower = name.toLowerCase()
    const match = allCategories.find(
      (c) =>
        c.translations.some((t) => t.name.toLowerCase().includes(lower)) ||
        c.id.toLowerCase().includes(lower)
    )
    return match?.id ?? null
  }

  // Wipe existing seed errors for this student+sourceId pair so re-runs are idempotent
  const existing = await prisma.studentError.findMany({
    where: { studentId: student.id, sourceType: 'conference', sourceId },
    select: { id: true },
  })
  if (existing.length > 0) {
    await prisma.studentErrorCategory.deleteMany({ where: { errorId: { in: existing.map(e => e.id) } } })
    await prisma.studentError.deleteMany({ where: { id: { in: existing.map(e => e.id) } } })
    console.log(`🗑  Deleted ${existing.length} existing seed errors (re-seeding)`)
  }

  let created = 0

  for (const e of ERRORS) {
    const err = await prisma.studentError.create({
      data: {
        studentId: student.id,
        sourceType: 'conference',
        sourceId,
        description: e.description,
        fragment: e.fragment ?? null,
        isCorrection: e.isCorrection,
        createdAt: daysAgo(e.daysBack),
      },
    })

    // Link categories
    const catIds: string[] = []
    for (const name of e.categoryNames ?? []) {
      const id = findCategoryId(name)
      if (id) catIds.push(id)
    }
    const unique = [...new Set(catIds)]
    for (const categoryId of unique) {
      await prisma.studentErrorCategory.create({
        data: { errorId: err.id, categoryId },
      })
    }

    console.log(
      `${e.isCorrection ? '✅ Correction' : '❌ Error'} [${unique.length} cats]: ${e.description.slice(0, 60)}…`
    )
    created++
  }

  console.log(`\n✔ Done. Created ${created} StudentError records.`)
  console.log(`  Student: ${student.email} (${student.id})`)
  console.log(`  Teacher: ${teacher.email} (${teacher.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
