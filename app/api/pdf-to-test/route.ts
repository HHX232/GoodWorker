import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'
import { callAI, parseJSON } from '@/lib/openrouter'
import { prisma } from '@/shared/prisma/prisma'

const PDF_SERVICE = process.env.PDF_SERVICE_URL ?? 'http://localhost:3001'

export const maxDuration = 60

// MIME types allowed only for VIP users
const VIP_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword',                                                       // DOC (legacy)
  'text/plain',
  'text/rtf',
  'application/rtf',
  'application/x-rtf',
  'application/vnd.oasis.opendocument.text',                                  // ODT
])

const PDF_MIMES = new Set(['application/pdf'])

const EXT_TO_MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.txt':  'text/plain',
  '.rtf':  'application/rtf',
  '.odt':  'application/vnd.oasis.opendocument.text',
}

async function resolveVip(email: string): Promise<boolean> {
  const now = new Date()
  const teacher = await prisma.teacher.findUnique({ where: { email }, select: { isVip: true, vipExpiresAt: true } })
  if (teacher) return teacher.isVip && (!teacher.vipExpiresAt || teacher.vipExpiresAt > now)
  const student = await prisma.student.findUnique({ where: { email }, select: { isVip: true, vipExpiresAt: true } })
  if (student) return student.isVip && (!student.vipExpiresAt || student.vipExpiresAt > now)
  return false
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const isGuest = !session?.user?.email
  const userEmail = session?.user?.email ?? null

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Файл обязателен' }, { status: 400 })
  }

  const fileName = (file as File).name ?? 'document'
  const ext = ('.' + fileName.split('.').pop()!.toLowerCase()) as string
  // Prefer explicit MIME, fall back to extension
  const mimeType = (file.type && file.type !== 'application/octet-stream')
    ? file.type
    : (EXT_TO_MIME[ext] ?? 'application/octet-stream')

  const isPdf = PDF_MIMES.has(mimeType)
  const isVipFormat = VIP_MIMES.has(mimeType)

  if (!isPdf && !isVipFormat) {
    return NextResponse.json({ error: 'Поддерживаются PDF, DOCX, TXT, RTF, ODT' }, { status: 400 })
  }

  // ── VIP check for non-PDF formats ───────────────────────────
  if (isVipFormat) {
    if (isGuest) {
      return NextResponse.json({ error: 'DOCX, TXT, RTF и ODT доступны только зарегистрированным VIP пользователям', vipRequired: true }, { status: 403 })
    }
    const isVip = await resolveVip(userEmail!)
    if (!isVip) {
      return NextResponse.json({ error: 'Загрузка DOCX, TXT и RTF доступна только VIP пользователям', vipRequired: true }, { status: 403 })
    }
  }

  // ── Step 1: extract text via microservice ─────────────────
  const docForm = new FormData()
  // Use a proper File object so multer sees the correct MIME
  const fileBlob = new File([file], fileName, { type: mimeType })
  docForm.append('file', fileBlob, fileName)

  // PDF → existing endpoint; other formats → new universal endpoint
  const extractEndpoint = isPdf
    ? `${PDF_SERVICE}/api/pdf/extract-from-upload`
    : `${PDF_SERVICE}/api/pdf/extract-document-from-upload`

  let docText = ''
  let pageCount = 1
  let ocr = false
  let docFormat = isPdf ? 'pdf' : ext.slice(1)

  try {
    const svcRes = await fetch(extractEndpoint, { method: 'POST', body: docForm })
    if (!svcRes.ok) {
      const errText = await svcRes.text()
      console.error('[pdf-to-test] microservice error:', errText)
      return NextResponse.json({ error: 'Ошибка извлечения текста из документа' }, { status: 502 })
    }
    const svcData = await svcRes.json()
    docText   = svcData.data?.text      ?? ''
    pageCount = svcData.data?.pageCount ?? 1
    ocr       = svcData.data?.ocr       ?? false
    docFormat = svcData.data?.format    ?? docFormat
  } catch (e) {
    console.error('[pdf-to-test] microservice unreachable:', e)
    return NextResponse.json({ error: 'Сервис обработки документов недоступен' }, { status: 503 })
  }

  if (!docText.trim()) {
    return NextResponse.json({ error: 'Документ не содержит текста — попробуйте другой файл' }, { status: 422 })
  }

  // ── Step 2: parse questions with AI ──────────────────────
  const maxQ    = isGuest ? 5 : 20
  const maxChars = isGuest ? 4000 : 14000
  const truncated = docText.slice(0, maxChars)

  const aiPrompt = `Extract up to ${maxQ} quiz questions from the text below (extracted from a ${docFormat.toUpperCase()} document).
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
- Output at most ${maxQ} questions
- Keep question/option text clean (strip leading "A)", "1." numbering etc.)

Document text:
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
    title: parsed.title ?? 'Тест из документа',
    questions: (parsed.questions ?? []).slice(0, maxQ),
    pageCount,
    ocr,
    format: docFormat,
    isGuest,
    guestLimit: isGuest ? maxQ : null,
    totalChars: docText.length,
  })
}
