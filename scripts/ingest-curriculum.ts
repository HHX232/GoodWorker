/**
 * Loads curriculum programs (Минобр PDF → txt dumps) into CurriculumProgram.
 * Compresses each raw text into a compact topic outline via one AI pass —
 * only when the raw text actually changed (rawHash), so reruns are free.
 * Run: npx tsx scripts/ingest-curriculum.ts [sourceDir]
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { callAI, parseJSON } from '../src/lib/openrouter'

const prisma = new PrismaClient()

const SOURCE_DIR = process.argv[2] ?? process.env.CURRICULUM_SOURCE_DIR ?? '/Users/nikitatisevic/Desktop/pdf_to_text_output'

const FOLDER_RE = /^(.+)_(\d+)-(\d+)_by_grade$/
const GRADE_FILE_RE = /^klass_(\d+)\.txt$/
const GENERAL_FILE = '00_obshchee.txt'
const STANDALONE_FILE_RE = /^(.+)_(\d+)-(\d+)\.txt$/

// Chunk boundary for the compression pass — большие klass_*.txt (сотни Кб) режем
// по пустым строкам, чтобы не резать тему посередине. Держим куски небольшими:
// у этих текстов вывод (JSON тем) по длине сравним со входом, а у модели есть
// потолок длины ответа (см. MAX_TOKENS ниже) — крупные куски обрезаются на середине.
const CHUNK_SIZE = 12_000

interface CurriculumEntry {
  subject: string
  scope: 'grade' | 'general' | 'full'
  gradeFrom: number
  gradeTo: number
  grade: number | null
  sourceFile: string
}

interface SummarySection {
  title: string
  topics: string[]
}

interface Summary {
  sections: SummarySection[]
}

const SUMMARY_SYSTEM_PROMPT = `Ты извлекаешь структуру учебной программы из текста официального документа (учебная программа/ФГОС).
Верни ТОЛЬКО валидный JSON вида {"sections":[{"title":"строка","topics":["строка", ...]}]}, без markdown-разметки.

Правила:
1. title — название раздела/главы программы, дословно как в тексте.
2. topics — темы этого раздела; каждая строка — дословная формулировка темы/навыка из текста, без пересказа, упрощения или перефразирования.
3. Не добавляй тем и разделов, которых нет в тексте. Не добавляй пояснений, методических комментариев, вводных фраз — только сами формулировки тем.
4. Если внутри темы есть перечисление подпунктов — разбивай их на отдельные строки в topics, а не единым блоком.
5. Служебные фрагменты текста (номера страниц вида "-- N of M --", выходные данные издания, УДК/ББК, содержание/оглавление) — игнорируй, это не темы.`

async function findEntries(root: string): Promise<CurriculumEntry[]> {
  const entries: CurriculumEntry[] = []
  const items = await readdir(root, { withFileTypes: true })

  for (const item of items) {
    if (item.name.startsWith('.')) continue

    if (item.isDirectory()) {
      const m = item.name.match(FOLDER_RE)
      if (!m) continue
      const [, subject, from, to] = m
      const gradeFrom = Number(from)
      const gradeTo = Number(to)

      const files = await readdir(path.join(root, item.name))
      for (const file of files) {
        if (file === GENERAL_FILE) {
          entries.push({
            subject, scope: 'general', gradeFrom, gradeTo, grade: null,
            sourceFile: path.join(item.name, file),
          })
          continue
        }
        const gm = file.match(GRADE_FILE_RE)
        if (gm) {
          entries.push({
            subject, scope: 'grade', gradeFrom, gradeTo, grade: Number(gm[1]),
            sourceFile: path.join(item.name, file),
          })
        }
      }
      continue
    }

    const fm = item.name.match(STANDALONE_FILE_RE)
    if (fm) {
      const [, subject, from, to] = fm
      entries.push({
        subject, scope: 'full', gradeFrom: Number(from), gradeTo: Number(to), grade: null,
        sourceFile: item.name,
      })
    }
  }

  return entries
}

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]

  const paragraphs = text.split(/\n\s*\n/)
  const chunks: string[] = []
  let current = ''

  for (const p of paragraphs) {
    if (current.length + p.length > CHUNK_SIZE && current) {
      chunks.push(current)
      current = ''
    }
    current += (current ? '\n\n' : '') + p
  }
  if (current) chunks.push(current)

  return chunks
}

function mergeSections(chunks: Summary[]): Summary {
  const sections: SummarySection[] = []

  for (const chunk of chunks) {
    for (const section of chunk.sections ?? []) {
      const last = sections[sections.length - 1]
      if (last && last.title === section.title) {
        for (const topic of section.topics ?? []) {
          if (!last.topics.includes(topic)) last.topics.push(topic)
        }
      } else {
        sections.push({ title: section.title, topics: [...(section.topics ?? [])] })
      }
    }
  }

  return { sections }
}

const MAX_TOKENS = 8000
// Ниже этой длины кусок дальше не дробим — если и на таком размере модель
// не осиливает валидный JSON, значит проблема не в размере, а в контенте.
const MIN_SPLITTABLE_LENGTH = 3000

/** Один прогон извлечения тем; при обрезанном/невалидном JSON-ответе (упёрлись
 * в лимит длины ответа модели) делит текст пополам по границе пустой строки
 * и повторяет рекурсивно — не роняет весь батч из-за одного плотного куска. */
async function summarizeChunk(text: string): Promise<Summary> {
  try {
    const raw = await callAI(SUMMARY_SYSTEM_PROMPT, text, { temperature: 0, maxTokens: MAX_TOKENS })
    return parseJSON<Summary>(raw)
  } catch (err) {
    if (text.length < MIN_SPLITTABLE_LENGTH) throw err
    const mid = Math.floor(text.length / 2)
    const boundary = text.lastIndexOf('\n\n', mid)
    const cut = boundary > 1000 ? boundary : mid
    console.warn(`[ingest-curriculum] ⚠ chunk parse failed (${text.length} chars), retrying as 2 smaller chunks: ${(err as Error).message}`)
    const [a, b] = await Promise.all([summarizeChunk(text.slice(0, cut)), summarizeChunk(text.slice(cut))])
    return mergeSections([a, b])
  }
}

async function summarize(rawText: string, label: string): Promise<Summary> {
  const chunks = chunkText(rawText)
  const results: Summary[] = []

  for (let i = 0; i < chunks.length; i++) {
    const userPrompt = chunks.length > 1
      ? `Часть ${i + 1}/${chunks.length} документа. Извлеки темы только из этого фрагмента.\n\n${chunks[i]}`
      : chunks[i]
    results.push(await summarizeChunk(userPrompt))
  }

  const merged = chunks.length > 1 ? mergeSections(results) : results[0]

  const topicsCount = merged.sections.reduce((n, s) => n + s.topics.length, 0)
  const expectedMin = rawText.length / 2000
  if (topicsCount < expectedMin) {
    console.warn(`[ingest-curriculum] ⚠ ${label}: подозрительно мало тем извлечено (${topicsCount}, ожидалось от ~${Math.round(expectedMin)}) — проверь вручную`)
  }

  return merged
}

async function main() {
  const rootStat = await stat(SOURCE_DIR).catch(() => null)
  if (!rootStat?.isDirectory()) {
    console.error(`[ingest-curriculum] source dir not found: ${SOURCE_DIR}`)
    process.exit(1)
  }

  const entries = await findEntries(SOURCE_DIR)
  console.log(`[ingest-curriculum] found ${entries.length} source files in ${SOURCE_DIR}`)

  for (const entry of entries) {
    const label = `${entry.subject}/${entry.scope}${entry.grade ? `/${entry.grade}` : ''} (${entry.sourceFile})`
    const rawText = await readFile(path.join(SOURCE_DIR, entry.sourceFile), 'utf-8')
    const rawHash = createHash('sha256').update(rawText).digest('hex')

    // findUnique/upsert can't take null for a nullable field inside a compound
    // @@unique key (Prisma requires non-null there) — grade is null for
    // scope != "grade", so look up manually and create/update by id instead.
    const existing = await prisma.curriculumProgram.findFirst({
      where: {
        subject: entry.subject,
        scope: entry.scope,
        gradeFrom: entry.gradeFrom,
        gradeTo: entry.gradeTo,
        grade: entry.grade,
      },
    })

    if (existing && existing.rawHash === rawHash && existing.summary) {
      console.log(`[ingest-curriculum] skip (hash unchanged): ${label}`)
      continue
    }

    console.log(`[ingest-curriculum] summarizing: ${label} (${rawText.length} chars)`)
    const summary = await summarize(rawText, label)
    const topicsCount = summary.sections.reduce((n, s) => n + s.topics.length, 0)
    console.log(`[ingest-curriculum] done: ${label} — ${summary.sections.length} sections, ${topicsCount} topics`)

    const data = {
      subject: entry.subject,
      scope: entry.scope,
      gradeFrom: entry.gradeFrom,
      gradeTo: entry.gradeTo,
      grade: entry.grade,
      sourceFile: entry.sourceFile,
      rawText,
      rawHash,
      summary: summary as unknown as object,
      summarizedAt: new Date(),
    }

    if (existing) {
      await prisma.curriculumProgram.update({where: {id: existing.id}, data})
    } else {
      await prisma.curriculumProgram.create({data})
    }
  }

  console.log('[ingest-curriculum] done')
}

main()
  .catch((err) => {
    console.error('[ingest-curriculum] fatal:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
