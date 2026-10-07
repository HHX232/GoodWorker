import { NextRequest, NextResponse } from 'next/server'
import { callVisionAI } from '@/lib/openrouter'
import { parseSpineColor } from '@/shared/lib/tutorFiles/bookModel'
import { getFilesSessionUser, hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'

export const runtime = 'nodejs'
export const maxDuration = 30

const CHECK_TIMEOUT_MS = 12_000
const MAX_BASE64_CHARS = 6 * 1024 * 1024 // a 900px JPEG page is ~200 KB; this only stops abuse
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

const SYSTEM_PROMPT = 'Ты помогаешь выбрать обложку для книги. Возвращай ТОЛЬКО валидный JSON без markdown и без пояснений.'
const USER_PROMPT = `На изображении — первая страница PDF-файла.
1) Определи, это ОБЛОЖКА или ТИТУЛЬНЫЙ ЛИСТ (крупное название, оформление, иллюстрация, автор/издательство), а не обычная страница с текстом, таблицами, упражнениями или формулами.
2) Подбери цвет КОРЕШКА книги: гармоничный с изображением оттенок — чуть темнее и насыщеннее доминирующего цвета страницы (для чёрно-белой страницы — глубокий нейтральный тёмный).
Верни JSON: {"isCover": true|false, "spineColor": "#RRGGBB"}`

// The model may wrap the JSON in prose or a ```json fence: take the first balanced {...} (string-aware) and parse only that.
function firstJsonObject(raw: string): { isCover?: unknown; spineColor?: unknown } | undefined {
  const start = raw.indexOf('{')
  if (start < 0) return undefined
  let depth = 0
  let inStr = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try {
        const v: unknown = JSON.parse(raw.slice(start, i + 1))
        return v && typeof v === 'object' ? (v as { isCover?: unknown; spineColor?: unknown }) : undefined
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

const UNAVAILABLE = () => NextResponse.json({ error: 'UNAVAILABLE' })

// POST /api/tutor-files/books/cover-check — { imageBase64, mimeType } → { isCover, spineColor? } | { error: 'UNAVAILABLE' }.
// One vision call answers both questions; spineColor is dropped unless it is a valid #RRGGBB.
// Tutor with storage access only (same gate as POST /books: VIP_REQUIRED / 403). No DEEPSEEK_API_KEY, a model error or no answer within 12 s is
// UNAVAILABLE (HTTP 200: the client then lets the user pick the cover). The
// picture and the key are never logged.
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()

    const body = (await req.json().catch(() => null)) as { imageBase64?: unknown; mimeType?: unknown } | null
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : ''
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''
    if (!imageBase64 || imageBase64.length > MAX_BASE64_CHARS || !BASE64_RE.test(imageBase64)) return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
    if (!MIMES.has(mimeType)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })

    if (!process.env.DEEPSEEK_API_KEY) return UNAVAILABLE()

    // callVisionAI has its own long timeout and retries; we stop waiting after 12 s
    // (its request then runs out in the background, nothing is written either way).
    let timer: ReturnType<typeof setTimeout> | undefined
    const answer = await Promise.race([
      callVisionAI(SYSTEM_PROMPT, [{ mimeType, base64: imageBase64 }], USER_PROMPT, { temperature: 0, maxTokens: 60 })
        .then(firstJsonObject)
        .catch(() => undefined),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), CHECK_TIMEOUT_MS) }),
    ]).finally(() => clearTimeout(timer))

    if (typeof answer?.isCover !== 'boolean') {
      console.warn('[POST /api/tutor-files/books/cover-check] vision check unavailable')
      return UNAVAILABLE()
    }
    const spineColor = parseSpineColor(answer.spineColor)
    return NextResponse.json(spineColor ? { isCover: answer.isCover, spineColor } : { isCover: answer.isCover })
  } catch {
    console.error('[POST /api/tutor-files/books/cover-check] failed')
    return UNAVAILABLE()
  }
}
