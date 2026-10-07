import { NextRequest, NextResponse } from 'next/server'
import { callVisionAI, parseJSON } from '@/lib/openrouter'
import { getFilesSessionUser, hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'

export const runtime = 'nodejs'
export const maxDuration = 30

const CHECK_TIMEOUT_MS = 12_000
const MAX_BASE64_CHARS = 6 * 1024 * 1024 // a 900px JPEG page is ~200 KB; this only stops abuse
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

const SYSTEM_PROMPT = 'Ты помогаешь выбрать обложку для книги. Возвращай ТОЛЬКО валидный JSON без markdown и без пояснений.'
const USER_PROMPT = `На изображении — первая страница PDF-файла.
Определи, это ОБЛОЖКА или ТИТУЛЬНЫЙ ЛИСТ (крупное название, оформление, иллюстрация, автор/издательство), а не обычная страница с текстом, таблицами, упражнениями или формулами.
Верни JSON: {"isCover": true} — если это обложка/титул, {"isCover": false} — если обычная страница.`

const UNAVAILABLE = () => NextResponse.json({ error: 'UNAVAILABLE' })

// POST /api/tutor-files/books/cover-check — { imageBase64, mimeType } → { isCover } | { error: 'UNAVAILABLE' }.
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
    const verdict = await Promise.race([
      callVisionAI(SYSTEM_PROMPT, [{ mimeType, base64: imageBase64 }], USER_PROMPT, { temperature: 0, maxTokens: 30 })
        .then(raw => parseJSON<{ isCover?: unknown }>(raw).isCover)
        .catch(() => undefined),
      new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), CHECK_TIMEOUT_MS) }),
    ]).finally(() => clearTimeout(timer))

    if (typeof verdict !== 'boolean') {
      console.warn('[POST /api/tutor-files/books/cover-check] vision check unavailable')
      return UNAVAILABLE()
    }
    return NextResponse.json({ isCover: verdict })
  } catch {
    console.error('[POST /api/tutor-files/books/cover-check] failed')
    return UNAVAILABLE()
  }
}
