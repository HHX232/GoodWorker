import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { prisma } from '@/shared/prisma/prisma'
import { callAI, parseJSON } from '@/lib/openrouter'
import { nanoid } from 'nanoid'

const VIP_PAGE_LIMIT = 50
const FREE_PAGE_LIMIT = 5

function textToTiptap(text: string) {
  const paragraphs = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: s }],
    }))
  return { type: 'doc', content: paragraphs.length ? paragraphs : [{ type: 'paragraph', content: [] }] }
}

function normalizeBlocks(raw: unknown[]): unknown[] {
  return raw.map((b: any) => {
    const id = nanoid()
    if (b.type === 'INFO_TEXT') {
      return {
        id,
        type: 'INFO_TEXT',
        payload: { content: textToTiptap(b.payload?.text ?? '') },
      }
    }
    if (b.type === 'CHOOSE_OPTION') {
      return { id, type: 'CHOOSE_OPTION', payload: b.payload }
    }
    if (b.type === 'FREE_ANSWER') {
      return { id, type: 'FREE_ANSWER', payload: b.payload }
    }
    if (b.type === 'MATCH_PAIRS') {
      return { id, type: 'MATCH_PAIRS', payload: b.payload }
    }
    return null
  }).filter(Boolean)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: userId, role } = session.user as { id: string; role: string }
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Teachers only' }, { status: 403 })
    }

    // Check VIP status
    const teacher = await (prisma.teacher as any).findUnique({
      where: { id: userId },
      select: { isVip: true, vipExpiresAt: true },
    })
    const now = new Date()
    const isVip = !!(teacher?.isVip && teacher?.vipExpiresAt && new Date(teacher.vipExpiresAt) > now)
    const pageLimit = isVip ? VIP_PAGE_LIMIT : FREE_PAGE_LIMIT

    // Parse uploaded file
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    // Forward to PDF microservice
    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    console.log('[import-pdf] PDF_SERVICE_URL =', pdfServiceUrl)
    if (!pdfServiceUrl) return NextResponse.json({ error: 'PDF service not configured' }, { status: 503 })

    console.log(`[import-pdf] Forwarding "${file.name}" (${file.size} bytes) to microservice`)
    const pdfForm = new FormData()
    pdfForm.append('file', file)

    let pdfRes: Response
    try {
      pdfRes = await fetch(`${pdfServiceUrl}/api/pdf/extract-from-upload`, {
        method: 'POST',
        body: pdfForm,
      })
    } catch (fetchErr) {
      console.error('[import-pdf] Fetch to microservice failed:', fetchErr)
      return NextResponse.json({ error: 'PDF service unreachable' }, { status: 503 })
    }

    console.log('[import-pdf] Microservice responded:', pdfRes.status)
    if (!pdfRes.ok) {
      const err = await pdfRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? 'PDF extraction failed' }, { status: 502 })
    }

    const pdfData = await pdfRes.json()
    const { text, pageCount } = pdfData.data as { text: string; pageCount: number }
    console.log(`[import-pdf] Got ${pageCount} pages, ${text.length} chars`)

    if (pageCount > pageLimit) {
      return NextResponse.json(
        {
          error: 'PAGE_LIMIT_EXCEEDED',
          pageCount,
          limit: pageLimit,
          isVip,
        },
        { status: 422 },
      )
    }

    // Extract tables too (best-effort)
    let tablesText = ''
    try {
      const tableForm = new FormData()
      tableForm.append('file', file)
      const tableRes = await fetch(`${pdfServiceUrl}/api/pdf/extract-tables-from-upload`, {
        method: 'POST',
        body: tableForm,
      })
      if (tableRes.ok) {
        const tableData = await tableRes.json()
        const tables = tableData.data?.tables ?? []
        if (tables.length > 0) {
          tablesText = '\n\nTABLES:\n' + tables
            .slice(0, 5)
            .map((t: any, i: number) => {
              const rows = (t.rows ?? []).map((r: string[]) => r.join(' | ')).join('\n')
              return `Table ${i + 1}:\n${rows}`
            })
            .join('\n\n')
        }
      }
    } catch {
      // tables are optional, ignore errors
    }

    if (!process.env.OPENROUTER_API_KEY)
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })

    const isUnlimited = isVip || role === 'ADMIN'
    const CHUNK_SIZE = 40000

    const buildPrompt = (chunk: string, chunkIndex: number, totalChunks: number) => {
      const chunkNote = totalChunks > 1
        ? `\nThis is part ${chunkIndex + 1} of ${totalChunks}. Generate blocks only for this part's content.`
        : ''
      return `Analyze the content below (extracted from a PDF) and generate structured test blocks for an e-learning platform.${chunkNote}

Use ONLY these block types:
- CHOOSE_OPTION: multiple-choice question (3–5 options)
- FREE_ANSWER: open-ended question requiring a written answer
- MATCH_PAIRS: matching left items to right items (3–6 pairs)
- INFO_TEXT: informational/context block (section header, instructions, definition block)

Rules:
- Generate between 5 and 30 blocks depending on content length
- Detect the language of the content and generate all questions in THAT SAME LANGUAGE
- For CHOOSE_OPTION: option ids must be "o1", "o2", etc.; correctId must exactly match one option id
- For MATCH_PAIRS: pair ids must be "p1", "p2", etc.; use it when there are clear term↔definition or cause↔effect relationships
- For INFO_TEXT: preserve important context or section headings as plain text
- NEVER generate SEQUENCE, WORD_SCRAMBLE, DIALOGUE, HIGHLIGHT_TEXT blocks
- Include referenceAnswer in FREE_ANSWER whenever a model answer can be inferred

PDF CONTENT:
${chunk}

Return ONLY a valid JSON array (wrapped in {"blocks":[...]}):
{"blocks":[
  {"type":"CHOOSE_OPTION","payload":{"question":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctId":"o1"}},
  {"type":"FREE_ANSWER","payload":{"question":"...","referenceAnswer":"..."}},
  {"type":"MATCH_PAIRS","payload":{"pairs":[{"id":"p1","left":"...","right":"..."},{"id":"p2","left":"...","right":"..."},{"id":"p3","left":"...","right":"..."}]}},
  {"type":"INFO_TEXT","payload":{"text":"..."}}
]}`
    }

    const SYSTEM = 'You are an expert educational test generator. Return ONLY valid JSON, no markdown.'
    let allBlocks: unknown[] = []

    if (isUnlimited && text.length > CHUNK_SIZE) {
      // VIP/ADMIN: split into chunks, tables appended to first chunk only
      const chunks: string[] = []
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE))
      }
      const MAX_CHUNKS = 8
      const toProcess = chunks.slice(0, MAX_CHUNKS)
      console.log(`[import-pdf] VIP/ADMIN: processing ${toProcess.length} chunks of ${CHUNK_SIZE} chars`)

      for (let i = 0; i < toProcess.length; i++) {
        const chunkContent = toProcess[i] + (i === 0 ? tablesText : '')
        const raw = await callAI(SYSTEM, buildPrompt(chunkContent, i, toProcess.length), { temperature: 0.2 })
        const parsed = parseJSON<{ blocks: unknown[] }>(raw)
        allBlocks.push(...normalizeBlocks(parsed.blocks ?? []))
      }
    } else {
      // Free: single chunk, limit to CHUNK_SIZE chars (covers ~5 pages)
      const chunk = text.slice(0, CHUNK_SIZE) + tablesText
      const raw = await callAI(SYSTEM, buildPrompt(chunk, 0, 1), { temperature: 0.2 })
      const parsed = parseJSON<{ blocks: unknown[] }>(raw)
      allBlocks = normalizeBlocks(parsed.blocks ?? [])
    }

    return NextResponse.json({ blocks: allBlocks, pageCount, isVip })
  } catch (error) {
    console.error('[POST /api/tests/import-pdf]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
