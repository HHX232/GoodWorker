import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { prisma } from '@/shared/prisma/prisma'
import { callAI, parseJSON } from '@/lib/openrouter'
import { nanoid } from 'nanoid'

const VIP_PAGE_LIMIT = 50
const FREE_PAGE_LIMIT = 5

// ─── Block normalizers ────────────────────────────────────────────────────────

function textToTiptap(text: string) {
  const paragraphs = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ type: 'paragraph', content: [{ type: 'text', text: s }] }))
  return { type: 'doc', content: paragraphs.length ? paragraphs : [{ type: 'paragraph', content: [] }] }
}

function normalizeBlocks(raw: unknown[]): unknown[] {
  return raw
    .map((b: any) => {
      const id = nanoid()
      if (b.type === 'INFO_TEXT') {
        return { id, type: 'INFO_TEXT', payload: { content: textToTiptap(b.payload?.text ?? '') } }
      }
      if (b.type === 'CHOOSE_OPTION') {
        // correctId may be string (single) or string[] (multi-answer)
        const correctId = Array.isArray(b.payload?.correctId)
          ? b.payload.correctId
          : b.payload?.correctId ?? ''
        return { id, type: 'CHOOSE_OPTION', payload: { ...b.payload, correctId } }
      }
      if (b.type === 'FREE_ANSWER') return { id, type: 'FREE_ANSWER', payload: b.payload }
      if (b.type === 'MATCH_PAIRS') return { id, type: 'MATCH_PAIRS', payload: b.payload }
      return null
    })
    .filter(Boolean)
}

// ─── PDF microservice calls ───────────────────────────────────────────────────

interface PdfExtractResult {
  text: string
  pageCount: number
  tablesText: string
  imageBlocks: unknown[]
}

async function extractFromPdf(pdfServiceUrl: string, file: File): Promise<PdfExtractResult> {
  // Run text + tables + images in parallel (best-effort for tables & images)
  const textForm = new FormData()
  textForm.append('file', file)

  const tableForm = new FormData()
  tableForm.append('file', file)

  const imageForm = new FormData()
  imageForm.append('file', file)

  const [textRes, tableRes, imageRes] = await Promise.allSettled([
    fetch(`${pdfServiceUrl}/api/pdf/extract-from-upload`, { method: 'POST', body: textForm }),
    fetch(`${pdfServiceUrl}/api/pdf/extract-tables-from-upload`, { method: 'POST', body: tableForm }),
    fetch(`${pdfServiceUrl}/api/pdf/extract-images-from-upload`, { method: 'POST', body: imageForm }),
  ])

  // Text is required
  if (textRes.status === 'rejected' || !textRes.value.ok) {
    const msg = textRes.status === 'rejected'
      ? textRes.reason?.message
      : (await textRes.value.json().catch(() => ({}))).message
    throw new Error(msg ?? `PDF extraction failed for "${file.name}"`)
  }
  const textData = await textRes.value.json()
  const text = (textData.data?.text as string) ?? ''
  const pageCount = (textData.data?.pageCount as number) ?? 0

  // Tables (optional)
  let tablesText = ''
  if (tableRes.status === 'fulfilled' && tableRes.value.ok) {
    const td = await tableRes.value.json()
    const tables: any[] = td.data?.tables ?? []
    if (tables.length > 0) {
      tablesText = tables
        .slice(0, 5)
        .map((t: any, i: number) => {
          const rows = (t.rows ?? []).map((r: string[]) => r.join(' | ')).join('\n')
          return `Table ${i + 1}:\n${rows}`
        })
        .join('\n\n')
    }
  }

  // Images → INFO_MEDIA blocks (optional, stored as base64 data URLs)
  const imageBlocks: unknown[] = []
  if (imageRes.status === 'fulfilled' && imageRes.value.ok) {
    const id = await imageRes.value.json()
    const images: any[] = id.data?.images ?? []
    for (const img of images.slice(0, 10)) {
      if (!img.data) continue
      const dataUrl = `data:image/${img.format ?? 'png'};base64,${img.data}`
      imageBlocks.push({
        id: nanoid(),
        type: 'INFO_MEDIA',
        payload: { kind: 'image', url: dataUrl, caption: null },
      })
    }
  }

  console.log(
    `[import-pdf] "${file.name}": ${pageCount} pages, ${text.length} chars, ${tablesText ? 'tables ✓' : 'no tables'}, ${imageBlocks.length} images`,
  )

  return { text, pageCount, tablesText, imageBlocks }
}

// ─── AI prompt ────────────────────────────────────────────────────────────────

function buildPrompt(chunk: string, chunkIndex: number, totalChunks: number, fileCount: number) {
  const chunkNote =
    totalChunks > 1 ? `\nThis is part ${chunkIndex + 1} of ${totalChunks}. Generate blocks only for this part.` : ''
  const fileNote =
    fileCount > 1
      ? `\nYou are analyzing ${fileCount} documents together. Generate a unified set of blocks covering material from all documents.`
      : ''

  return `Analyze the content below (extracted from a PDF) and generate structured test blocks for an e-learning platform.${fileNote}${chunkNote}

Use ONLY these block types:
- CHOOSE_OPTION: question with options. Use "correctId": "o1" for ONE correct answer, or "correctId": ["o1","o3"] for MULTIPLE correct answers (when the source explicitly lists multiple correct answers, e.g. "A1 — 1,2,3")
- FREE_ANSWER: open-ended question requiring a written answer
- MATCH_PAIRS: matching left items to right items (3–6 pairs)
- INFO_TEXT: informational/context block (section header, instructions, definition)

Rules:
- Generate between 5 and 30 blocks depending on content length
- Detect the language of the content and generate all questions in THAT SAME LANGUAGE
- For CHOOSE_OPTION: option ids must be "o1","o2",... — correctId is a string for single answer, string array for multiple
- For MATCH_PAIRS: pair ids must be "p1","p2",...
- For INFO_TEXT: preserve important context or section headings as plain text
- NEVER generate SEQUENCE, WORD_SCRAMBLE, DIALOGUE, HIGHLIGHT_TEXT blocks
- Include referenceAnswer in FREE_ANSWER whenever a model answer can be inferred

PDF CONTENT:
${chunk}

Return ONLY a valid JSON object {"blocks":[...]}:
{"blocks":[
  {"type":"CHOOSE_OPTION","payload":{"question":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctId":"o1"}},
  {"type":"CHOOSE_OPTION","payload":{"question":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctId":["o1","o3"]}},
  {"type":"FREE_ANSWER","payload":{"question":"...","referenceAnswer":"..."}},
  {"type":"MATCH_PAIRS","payload":{"pairs":[{"id":"p1","left":"...","right":"..."},{"id":"p2","left":"...","right":"..."},{"id":"p3","left":"...","right":"..."}]}},
  {"type":"INFO_TEXT","payload":{"text":"..."}}
]}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: userId, role } = session.user as { id: string; role: string }
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Teachers only' }, { status: 403 })
    }

    const teacher = await (prisma.teacher as any).findUnique({
      where: { id: userId },
      select: { isVip: true, vipExpiresAt: true },
    })
    const now = new Date()
    const isVip = !!(teacher?.isVip && teacher?.vipExpiresAt && new Date(teacher.vipExpiresAt) > now)
    const isAdmin = role === 'ADMIN'
    const pageLimit = isAdmin ? Infinity : isVip ? VIP_PAGE_LIMIT : FREE_PAGE_LIMIT

    const formData = await req.formData()
    const fileEntries = formData.getAll('files') as File[]
    const files = fileEntries.filter((f) => f instanceof File && f.name.toLowerCase().endsWith('.pdf'))

    if (files.length === 0) return NextResponse.json({ error: 'No PDF files provided' }, { status: 400 })

    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    if (!pdfServiceUrl) return NextResponse.json({ error: 'PDF service not configured' }, { status: 503 })

    console.log(`[import-pdf] Processing ${files.length} file(s)`)

    // Extract all files via microservice
    const results: (PdfExtractResult & { name: string })[] = []
    for (const file of files) {
      try {
        const r = await extractFromPdf(pdfServiceUrl, file)
        results.push({ name: file.name, ...r })
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 })
      }
    }

    const totalPages = results.reduce((s, r) => s + r.pageCount, 0)
    if (totalPages > pageLimit) {
      return NextResponse.json(
        { error: 'PAGE_LIMIT_EXCEEDED', pageCount: totalPages, limit: pageLimit, isVip },
        { status: 422 },
      )
    }

    if (!process.env.OPENROUTER_API_KEY)
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })

    // Combine content: tables first (better structure), then text — no images
    const combinedContent = results
      .map((r) => {
        const header = results.length > 1 ? `=== DOCUMENT: ${r.name} ===\n` : ''
        const tablesSection = r.tablesText ? `TABLES:\n${r.tablesText}\n\nTEXT:\n` : ''
        return `${header}${tablesSection}${r.text}`
      })
      .join('\n\n')

    // All image blocks from all files (prepended before AI blocks)
    const allImageBlocks = results.flatMap((r) => r.imageBlocks)

    const isUnlimited = isAdmin || isVip
    const CHUNK_SIZE = 40_000
    const SYSTEM = 'You are an expert educational test generator. Return ONLY valid JSON, no markdown.'
    let aiBlocks: unknown[] = []

    if (isUnlimited && combinedContent.length > CHUNK_SIZE) {
      const chunks: string[] = []
      for (let i = 0; i < combinedContent.length; i += CHUNK_SIZE) chunks.push(combinedContent.slice(i, i + CHUNK_SIZE))
      const toProcess = chunks.slice(0, 8)
      console.log(`[import-pdf] VIP/ADMIN: ${toProcess.length} chunk(s)`)
      for (let i = 0; i < toProcess.length; i++) {
        const raw = await callAI(SYSTEM, buildPrompt(toProcess[i], i, toProcess.length, files.length), { temperature: 0.2 })
        const parsed = parseJSON<{ blocks: unknown[] }>(raw)
        aiBlocks.push(...normalizeBlocks(parsed.blocks ?? []))
      }
    } else {
      const raw = await callAI(SYSTEM, buildPrompt(combinedContent.slice(0, CHUNK_SIZE), 0, 1, files.length), { temperature: 0.2 })
      const parsed = parseJSON<{ blocks: unknown[] }>(raw)
      aiBlocks = normalizeBlocks(parsed.blocks ?? [])
    }

    // Images go first so the teacher sees them before questions
    const blocks = [...allImageBlocks, ...aiBlocks]

    return NextResponse.json({ blocks, pageCount: totalPages, isVip })
  } catch (error) {
    console.error('[POST /api/tests/import-pdf]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
