import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { callVisionAI, parseJSON } from '@/lib/openrouter'
import { resolveVip } from '@/lib/vipStatus'

export const maxDuration = 60

const MAX_PHOTOS = 10
const MAX_PHOTO_SIZE = 15 * 1024 * 1024 // 15 MB per photo (DeepSeek caps at 32 MiB, base64 inflates ~33%)
const MAX_QUESTIONS = 60 // VIP-only feature — same ceiling as the "unlimited" PDF mode

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  const session = await auth()
  const userEmail = session?.user?.email ?? null
  if (!userEmail) {
    return NextResponse.json({ error: 'Загрузка фото доступна только зарегистрированным VIP пользователям', vipRequired: true }, { status: 403 })
  }

  const isVip = await resolveVip(userEmail)
  if (!isVip) {
    return NextResponse.json({ error: 'Загрузка фото доступна только VIP пользователям', vipRequired: true }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 })
  }

  const files = formData.getAll('photos').filter((f): f is File => f instanceof Blob)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Нужно хотя бы одно фото' }, { status: 400 })
  }
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Можно загрузить не больше ${MAX_PHOTOS} фото за раз` }, { status: 400 })
  }

  const images: { mimeType: string; base64: string }[] = []
  for (const file of files) {
    const name = (file as File).name ?? 'photo'
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json({ error: `Формат «${name}» не поддерживается — используйте JPG, PNG, WEBP или GIF` }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: `Фото «${name}» пустое` }, { status: 400 })
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: `Фото «${name}» весит больше ${MAX_PHOTO_SIZE / 1024 / 1024} МБ` }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    images.push({ mimeType: file.type, base64: buf.toString('base64') })
  }

  const aiPrompt = `Look at the ${images.length} photo(s) provided — they show pages of study material (notes, a textbook, a worksheet, a slide, etc.), in the order given.
Read all text visible across the photos as one combined document and extract up to ${MAX_QUESTIONS} quiz questions from it.
Automatically detect the language of the text and respond in the same language.
Return ONLY valid JSON, exactly this shape:
{
  "title": "short test title",
  "questions": [
    { "type": "single",   "question": "...", "options": ["A","B","C","D"], "correct": 0 },
    { "type": "multi",    "question": "...", "options": ["A","B","C"],     "correct": [0,2] },
    { "type": "match",    "question": "...", "pairs": [["term","def"]] },
    { "type": "fill",     "question": "...", "answer": "exact answer" },
    { "type": "bool",     "statement": "...", "correct": true },
    { "type": "order",    "question": "...", "items": ["step1","step2","step3"] }
  ]
}
Rules:
- "correct" is 0-indexed for single/multi types
- Prefer single/multi when multiple answer choices are given
- If correct answers are not stated, use best judgment
- Output at most ${MAX_QUESTIONS} questions
- Keep question/option text clean (strip leading "A)", "1." numbering etc.)
- If a photo is blurry or partially unreadable, use what you can still make out and ignore the rest`

  let parsed: { title?: string; questions?: unknown[] }
  try {
    const raw = await callVisionAI(
      'You are an educational test parser with vision. Return ONLY valid JSON without markdown.',
      images,
      aiPrompt,
      { temperature: 0.1 },
    )
    parsed = parseJSON<{ title?: string; questions?: unknown[] }>(raw)
  } catch (e) {
    console.error('[pdf-to-test/photos] AI error:', e)
    return NextResponse.json({ error: 'Ошибка анализа фото' }, { status: 500 })
  }

  const questions = (parsed.questions ?? []).slice(0, MAX_QUESTIONS)
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Не удалось распознать текст на фото — попробуйте более чёткие снимки' }, { status: 422 })
  }

  return NextResponse.json({
    title: parsed.title ?? 'Тест из фото',
    questions,
    pageCount: images.length,
    ocr: true,
    format: 'photos',
    isGuest: false,
    guestLimit: null,
    unlimited: true,
    totalChars: 0,
  })
}
