import { callAI, parseJSON } from '@/lib/openrouter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryRef {
  id: string
  name: string
}

export interface Participant {
  userId: string | null
  name: string
  role: 'TEACHER' | 'STUDENT'
}

export interface DetectedError {
  studentName: string
  categoryIds: string[]
  description: string
  fragment: string | null
  type: 'error' | 'correction'
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `
Ты — образовательный аналитик. Тебе дают транскрипт урока и список участников.
Твоя задача — найти все ошибки которые совершили ученики, А ТАКЖЕ ошибки которые ученики ИСПРАВИЛИ (т.е. если учитель явно указал что ошибка была исправлена, или ученик сам назвал правильный вариант после исправления).

Правила:
1. Учитель НЕ делает ошибок — его реплики нужны только как контекст и для понимания кто ошибся/исправился.
2. Определи по контексту кто из учеников совершил ошибку или исправил ошибку.
3. Если в транскрипте явно называется имя — прикрепи к нему.
4. Если имя не указано и участников больше двух — используй "ALL_STUDENTS".
5. Для каждой записи подбери наиболее подходящие категории из предоставленного списка (можно несколько).
6. fragment — дословная короткая цитата из транскрипта, где видна ошибка или исправление. Если нет — null.
7. description — краткое описание на русском языке (1-2 предложения).
8. type: "error" если ошибка допущена в этом уроке, "correction" если ошибка была исправлена.

Верни ТОЛЬКО JSON-массив без markdown-блоков:
[
  {
    "studentName": "<имя ученика или ALL_STUDENTS>",
    "categoryIds": ["<id1>", "<id2>"],
    "description": "<описание>",
    "fragment": "<цитата или null>",
    "type": "error"
  }
]

Если ошибок и исправлений нет — верни пустой массив [].
`.trim()

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeTranscriptErrors(
  transcript: string,
  participants: Participant[],
  categories: CategoryRef[]
): Promise<DetectedError[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const categoriesBlock = categories.map(c => `  - id="${c.id}" name="${c.name}"`).join('\n')
  const participantsBlock = participants
    .map(p => `  - ${p.role === 'TEACHER' ? '[Учитель]' : '[Ученик]'} ${p.name}`)
    .join('\n')

  const prompt = `Список категорий для классификации ошибок:\n${categoriesBlock}\n\n=== УЧАСТНИКИ ===\n${participantsBlock}\n\n=== ТРАНСКРИПТ ===\n${transcript}`

  const raw = await callAI(SYSTEM_INSTRUCTION, prompt, { temperature: 0.2 })

  let parsed: DetectedError[]
  try {
    const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return []
    parsed = JSON.parse(match[0])
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter(
      e =>
        typeof e.studentName === 'string' &&
        Array.isArray(e.categoryIds) &&
        typeof e.description === 'string'
    )
    .map(e => ({
      ...e,
      type: e.type === 'correction' ? 'correction' : 'error',
    }))
}
