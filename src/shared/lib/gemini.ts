import { GoogleGenerativeAI } from '@google/generative-ai'

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })
}

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
}

const SYSTEM_PROMPT = `
Ты — образовательный аналитик. Тебе дают транскрипт урока и список участников.
Твоя задача — найти все ошибки, которые совершили ученики в ходе урока.

Правила:
1. Учитель НЕ делает ошибок — его реплики нужны только как контекст и для понимания кто ошибся.
2. Определи по контексту кто из учеников совершил ошибку.
3. Если в транскрипте явно называется имя — прикрепи ошибку к нему.
4. Если имя не указано и участников больше двух — прикрепи ошибку ко всем ученикам (используй "ALL_STUDENTS").
5. Для каждой ошибки подбери наиболее подходящие категории из предоставленного списка (можно несколько).
6. fragment — дословная короткая цитата из транскрипта, где видна ошибка. Если цитата не найдена — null.
7. description — краткое описание ошибки (1-2 предложения, на русском языке).

Верни ТОЛЬКО JSON-массив без markdown-блоков:
[
  {
    "studentName": "<имя ученика или ALL_STUDENTS>",
    "categoryIds": ["<id1>", "<id2>"],
    "description": "<описание ошибки>",
    "fragment": "<цитата или null>"
  }
]

Если ошибок нет — верни пустой массив [].
`

export async function analyzeTranscriptErrors(
  transcript: string,
  participants: Participant[],
  categories: CategoryRef[]
): Promise<DetectedError[]> {
  const categoriesText = categories
    .map(c => `  - id="${c.id}" name="${c.name}"`)
    .join('\n')

  const participantsText = participants
    .map(p => `  - ${p.role === 'TEACHER' ? '[Учитель]' : '[Ученик]'} ${p.name}`)
    .join('\n')

  const prompt = `
${SYSTEM_PROMPT}

=== УЧАСТНИКИ ===
${participantsText}

=== КАТЕГОРИИ ДЛЯ КЛАССИФИКАЦИИ ===
${categoriesText}

=== ТРАНСКРИПТ ===
${transcript}
`

  const result = await getModel().generateContent(prompt)
  const text = result.response.text().trim()

  let parsed: DetectedError[]
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    parsed = JSON.parse(match[0])
  }

  if (!Array.isArray(parsed)) return []

  return parsed.filter(
    e =>
      typeof e.studentName === 'string' &&
      Array.isArray(e.categoryIds) &&
      typeof e.description === 'string'
  )
}
