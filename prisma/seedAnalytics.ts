import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

// Generates a realistic growth curve: starts low, accelerates, slight noise
function growthCurve(dayIndex: number, totalDays: number, minPerDay: number, maxPerDay: number): number {
  const progress = dayIndex / totalDays
  const trend = minPerDay + (maxPerDay - minPerDay) * Math.pow(progress, 0.7)
  const noise = (Math.random() - 0.5) * 2
  return Math.max(0, Math.round(trend + noise))
}

// Returns a random time on a given day
function randomTimeOnDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(Math.floor(Math.random() * 14) + 8) // 08:00–22:00
  d.setMinutes(Math.floor(Math.random() * 60))
  return d
}

// All days from Jan 1 to Jun 30 2023
function allDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(start)
  while (cur < end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

const JAN = new Date('2023-01-01')
const JUL = new Date('2023-07-01')

export async function seedAnalytics() {
  // Clear old seed data to avoid duplicates on re-run
  await prisma.postView.deleteMany({where: {viewedAt: {gte: JAN, lt: JUL}}})
  await prisma.roadmapView.deleteMany({where: {viewedAt: {gte: JAN, lt: JUL}}})
  await prisma.studentTestAttempt.deleteMany({where: {startedAt: {gte: JAN, lt: JUL}}})

  const [posts, roadmaps, tests, students] = await Promise.all([
    prisma.post.findMany({select: {id: true, teacherId: true}, take: 30}),
    prisma.roadmap.findMany({select: {id: true, teacherId: true}, take: 15}),
    prisma.test.findMany({select: {id: true, teacherId: true}, take: 15}),
    prisma.student.findMany({select: {id: true}, take: 50}),
  ])

  if (!students.length || (!posts.length && !roadmaps.length && !tests.length)) {
    console.log('⚠️  seedAnalytics: недостаточно данных в БД, пропускаем')
    return
  }

  const days = allDaysInRange(JAN, JUL)
  const totalDays = days.length // ~181

  // ── PostView ──────────────────────────────────────────────
  // Build pool of unique (postId, studentId) pairs
  const postViewPairs: {postId: string; studentId: string}[] = []
  for (const post of posts) {
    for (const student of students) {
      if (student.id !== post.teacherId) {
        postViewPairs.push({postId: post.id, studentId: student.id})
      }
    }
  }
  // Shuffle
  postViewPairs.sort(() => Math.random() - 0.5)

  let pairIdx = 0
  const postViewData: {postId: string; studentId: string; viewerRole: 'STUDENT'; viewedAt: Date}[] = []

  for (let i = 0; i < totalDays && pairIdx < postViewPairs.length; i++) {
    const count = growthCurve(i, totalDays, 2, 12)
    for (let j = 0; j < count && pairIdx < postViewPairs.length; j++) {
      postViewData.push({
        ...postViewPairs[pairIdx],
        viewerRole: 'STUDENT',
        viewedAt: randomTimeOnDay(days[i]),
      })
      pairIdx++
    }
  }

  await prisma.postView.createMany({data: postViewData, skipDuplicates: true})

  // Sync viewCount
  for (const post of posts) {
    const count = await prisma.postView.count({where: {postId: post.id}})
    await prisma.post.update({where: {id: post.id}, data: {viewCount: count}})
  }

  // ── RoadmapView ───────────────────────────────────────────
  const roadmapViewPairs: {roadmapId: string; studentId: string}[] = []
  for (const roadmap of roadmaps) {
    for (const student of students) {
      if (student.id !== roadmap.teacherId) {
        roadmapViewPairs.push({roadmapId: roadmap.id, studentId: student.id})
      }
    }
  }
  roadmapViewPairs.sort(() => Math.random() - 0.5)

  let rvIdx = 0
  const roadmapViewData: {roadmapId: string; studentId: string; viewerRole: 'STUDENT'; viewedAt: Date}[] = []

  for (let i = 0; i < totalDays && rvIdx < roadmapViewPairs.length; i++) {
    const count = growthCurve(i, totalDays, 0, 5)
    for (let j = 0; j < count && rvIdx < roadmapViewPairs.length; j++) {
      roadmapViewData.push({
        ...roadmapViewPairs[rvIdx],
        viewerRole: 'STUDENT',
        viewedAt: randomTimeOnDay(days[i]),
      })
      rvIdx++
    }
  }

  await prisma.roadmapView.createMany({data: roadmapViewData, skipDuplicates: true})

  // ── StudentTestAttempt ────────────────────────────────────
  // No unique constraint — can create multiple per day freely
  const attemptData: {
    studentId: string; testId: string; score: number; maxScore: number
    percent: number; answers: object; startedAt: Date; finishedAt: Date
  }[] = []

  for (let i = 0; i < totalDays; i++) {
    const count = growthCurve(i, totalDays, 1, 8)
    for (let j = 0; j < count; j++) {
      const student = students[Math.floor(Math.random() * students.length)]
      const test = tests[Math.floor(Math.random() * tests.length)]
      const percent = Math.round(30 + Math.random() * 70)
      const startedAt = randomTimeOnDay(days[i])
      attemptData.push({
        studentId: student.id,
        testId: test.id,
        score: percent,
        maxScore: 100,
        percent,
        answers: {},
        startedAt,
        finishedAt: new Date(startedAt.getTime() + (3 + Math.random() * 10) * 60 * 1000),
      })
    }
  }

  await prisma.studentTestAttempt.createMany({data: attemptData})

  console.log(
    `✅ seedAnalytics: ${postViewData.length} PostView, ${roadmapViewData.length} RoadmapView, ${attemptData.length} TestAttempt`,
  )
}

// Запуск напрямую
if (require.main === module) {
  seedAnalytics()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
