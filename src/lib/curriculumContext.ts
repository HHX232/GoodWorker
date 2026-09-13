import { prisma } from '@/shared/prisma/prisma'

interface SummarySection {
  title: string
  topics: string[]
}

interface Summary {
  sections: SummarySection[]
}

const CACHE_TTL_MS = 60 * 60 * 1000

const cache = new Map<string, { value: string; expiresAt: number }>()

function formatSummary(summary: unknown): string | null {
  const s = summary as Summary | null
  if (!s?.sections?.length) return null
  return s.sections
    .map(section => `${section.title}:\n${section.topics.map(t => `- ${t}`).join('\n')}`)
    .join('\n\n')
}

/**
 * Компактный конспект программы предмета для промпта ИИ-планировщика.
 * Возвращает '' если по (subject, grade) ничего не загружено — вызывающий
 * код просто не добавляет блок, старое поведение (знания модели "из головы")
 * сохраняется как graceful fallback.
 */
export async function getCurriculumContextForPrompt(subject: string, grade: number): Promise<string> {
  const cacheKey = `${subject}:${grade}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const rows = await prisma.curriculumProgram.findMany({
    where: {
      subject,
      OR: [
        { scope: 'general', gradeFrom: { lte: grade }, gradeTo: { gte: grade } },
        { scope: 'full', gradeFrom: { lte: grade }, gradeTo: { gte: grade } },
        { scope: 'grade', grade },
        { scope: 'grade', grade: grade - 1 },
      ],
    },
    select: { scope: true, grade: true, summary: true },
  })

  const overview = rows.find(r => r.scope === 'general' || r.scope === 'full')
  const currentGrade = rows.find(r => r.scope === 'grade' && r.grade === grade)
  const priorGrade = rows.find(r => r.scope === 'grade' && r.grade === grade - 1)

  const parts: string[] = []

  const overviewText = overview ? formatSummary(overview.summary) : null
  if (overviewText) parts.push(`=== ПРОГРАММА ПРЕДМЕТА (общий обзор) ===\n${overviewText}`)

  const currentText = currentGrade ? formatSummary(currentGrade.summary) : null
  if (currentText) parts.push(`=== ПРОГРАММА ПРЕДМЕТА (конспект, класс ${grade}) ===\n${currentText}`)

  const priorText = priorGrade ? formatSummary(priorGrade.summary) : null
  if (priorText) parts.push(`=== ПРОГРАММА: КЛАСС НИЖЕ, для повторения (класс ${grade - 1}) ===\n${priorText}`)

  const value = parts.join('\n\n')
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}
