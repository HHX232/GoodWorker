import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { callAI, parseJSON } from '@/lib/openrouter'

const PDF_SERVICE = process.env.PDF_SERVICE_URL ?? 'http://localhost:3001'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  const isGuest = !session?.user

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'PDF файл обязателен' }, { status: 400 })
  }

  const fileName = (file as File).name ?? 'document.pdf'
  if (!fileName.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Поддерживаются только PDF файлы' }, { status: 400 })
  }

  // ── Step 1: extract text via PDF microservice ─────────────
  const pdfForm = new FormData()
  pdfForm.append('file', file, fileName)

  let pdfText = ''
  let pageCount = 1
  let ocr = false

  try {
    const pdfRes = await fetch(`${PDF_SERVICE}/api/pdf/extract-from-upload`, {
      method: 'POST',
      body: pdfForm,
    })
    if (!pdfRes.ok) {
      const errText = await pdfRes.text()
      console.error('[pdf-to-test] microservice error:', errText)
      return NextResponse.json({ error: 'Ошибка извлечения текста из PDF' }, { status: 502 })
    }
    const pdfData = await pdfRes.json()
    pdfText = pdfData.data?.text ?? ''
    pageCount = pdfData.data?.pageCount ?? 1
    ocr = pdfData.data?.ocr ?? false
  } catch (e) {
    console.error('[pdf-to-test] microservice unreachable:', e)
    return NextResponse.json({ error: 'Сервис обработки PDF недоступен' }, { status: 503 })
  }

  if (!pdfText.trim()) {
    return NextResponse.json({ error: 'PDF не содержит текста — попробуйте другой файл' }, { status: 422 })
  }

  // ── Step 2: parse questions with AI ──────────────────────
  // Guest: max 5 questions from ~2 pages; logged-in: up to 20 from full doc
  const maxQ = isGuest ? 5 : 20
  const maxChars = isGuest ? 4000 : 14000
  const truncated = pdfText.slice(0, maxChars)

  const aiPrompt = `Extract up to ${maxQ} quiz questions from the text below (extracted from a PDF).
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
- Detect the type from context; prefer single/multi when multiple answers are given
- If correct answers are not stated, use your best judgment
- Output at most ${maxQ} questions, pick the most complete/clear ones
- Keep question/option text clean (no leading "A)", "1." etc.)

PDF text:
${truncated}`

  let parsed: { title?: string; questions?: unknown[] }
  try {
    const raw = await callAI(
      'You are an educational test parser. Return ONLY valid JSON without markdown.',
      aiPrompt,
      { temperature: 0.1 },
    )
    parsed = parseJSON<{ title?: string; questions?: unknown[] }>(raw)
  } catch (e) {
    console.error('[pdf-to-test] AI error:', e)
    return NextResponse.json({ error: 'Ошибка анализа вопросов' }, { status: 500 })
  }

  return NextResponse.json({
    title: parsed.title ?? 'Тест из PDF',
    questions: (parsed.questions ?? []).slice(0, maxQ),
    pageCount,
    ocr,
    isGuest,
    guestLimit: isGuest ? maxQ : null,
    totalChars: pdfText.length,
  })
}
