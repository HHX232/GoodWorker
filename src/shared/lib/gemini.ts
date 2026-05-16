import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAICacheManager } from '@google/generative-ai/server'

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
}

// ─── System prompt (cached) ───────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `
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
`.trim()

// ─── Module-level cache state ─────────────────────────────────────────────────
// On Railway the process is long-running, so in-memory is fine.
// Cache is invalidated when categories change (content hash) or TTL expires.

interface CacheEntry {
  name: string         // Gemini cache resource name
  hash: string         // MD5-like hash of categories
  expireAt: number     // timestamp ms — we refresh 5 min before Google TTL
}

let _cache: CacheEntry | null = null

const CACHE_TTL_SECONDS = 3600          // 1 hour at Google's side
const CACHE_REFRESH_BEFORE_MS = 5 * 60 * 1000  // refresh 5 min before expiry

function hashCategories(cats: CategoryRef[]): string {
  return cats.map(c => `${c.id}:${c.name}`).sort().join('|')
}

function buildCategoriesBlock(cats: CategoryRef[]): string {
  return cats.map(c => `  - id="${c.id}" name="${c.name}"`).join('\n')
}

function getClients(apiKey: string) {
  return {
    genAI: new GoogleGenerativeAI(apiKey),
    cacheManager: new GoogleAICacheManager(apiKey),
  }
}

// Returns a model instance backed by the Gemini context cache.
// Falls back to a plain (uncached) model if the content is too small
// for Google's minimum token threshold.
async function getModelWithCache(cats: CategoryRef[]) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const { genAI, cacheManager } = getClients(apiKey)
  const hash = hashCategories(cats)
  const now = Date.now()

  // ── Hit: cache is fresh and categories unchanged ──────────────────────────
  if (_cache && _cache.hash === hash && _cache.expireAt > now) {
    try {
      const cached = await cacheManager.get(_cache.name)
      return genAI.getGenerativeModelFromCachedContent(cached)
    } catch {
      // Cache evicted early — fall through to recreate
      _cache = null
    }
  }

  // ── Miss: delete stale cache (best-effort) ────────────────────────────────
  if (_cache) {
    try { await cacheManager.delete(_cache.name) } catch {}
    _cache = null
  }

  // ── Create new cache ──────────────────────────────────────────────────────
  // Cached content = system instruction + categories "primer" turn.
  // Only the per-request part (participants + transcript) is billed as fresh tokens.
  const categoriesBlock = buildCategoriesBlock(cats)

  try {
    const created = await cacheManager.create({
      model: 'models/gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Ниже полный список категорий для классификации ошибок:\n\n${categoriesBlock}\n\nЗапомни эти категории.` }],
        },
        {
          role: 'model',
          parts: [{ text: 'Категории запомнил. Жду транскрипт и список участников.' }],
        },
      ],
      ttlSeconds: CACHE_TTL_SECONDS,
    })

    _cache = {
      name: created.name!,
      hash,
      expireAt: now + CACHE_TTL_SECONDS * 1000 - CACHE_REFRESH_BEFORE_MS,
    }

    return genAI.getGenerativeModelFromCachedContent(created)
  } catch (err: any) {
    // Google rejects if cached content is below the minimum token threshold.
    // Gracefully fall back to a regular model.
    console.warn('[gemini] context cache unavailable, using uncached model:', err?.message ?? err)
    return genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeTranscriptErrors(
  transcript: string,
  participants: Participant[],
  categories: CategoryRef[]
): Promise<DetectedError[]> {
  const model = await getModelWithCache(categories)

  const participantsBlock = participants
    .map(p => `  - ${p.role === 'TEACHER' ? '[Учитель]' : '[Ученик]'} ${p.name}`)
    .join('\n')

  // Only non-cached (variable) content goes here
  const prompt = `=== УЧАСТНИКИ ===\n${participantsBlock}\n\n=== ТРАНСКРИПТ ===\n${transcript}`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  })

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
