import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { callAI, callVisionAI, parseJSON, type AIUsage } from '@/lib/openrouter'
import { resolveVip } from '@/lib/vipStatus'
import { kindOf, extOf, MAX_PHOTOS } from '@/shared/constants/pdfImport'
import { nanoid } from 'nanoid'
import { getWalletSessionUser, preflightCheck, chargeForAICall, InsufficientBalanceError, type WalletUser } from '@/shared/lib/wallet/wallet'

const VIP_PAGE_LIMIT = 50
const FREE_PAGE_LIMIT = 5
const CHUNK_SIZE = 40_000
// ponytail: rough per-photo padding for the preflight upper bound only — the
// vision model's real cost comes from image tokens, not chars, and this repo
// has no char-equivalent for that yet. Actual charge always uses real usage
// from the provider response, so this only affects how conservative the
// pre-call estimate is, never the amount actually billed.
const VISION_PROMPT_CHARS_PER_PHOTO = 4000

const EXT_TO_IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
}

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

// DOCX/TXT/RTF/ODT — same universal endpoint used by /api/pdf-to-test for the
// public landing page; no table/image extraction there, text only.
async function extractFromDocument(pdfServiceUrl: string, file: File): Promise<PdfExtractResult> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${pdfServiceUrl}/api/pdf/extract-document-from-upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).message
    throw new Error(msg ?? `Document extraction failed for "${file.name}"`)
  }
  const data = await res.json()
  const text = (data.data?.text as string) ?? ''
  const pageCount = (data.data?.pageCount as number) ?? 1

  console.log(`[import-pdf] "${file.name}" (doc): ${pageCount} pages, ${text.length} chars`)

  return { text, pageCount, tablesText: '', imageBlocks: [] }
}

// VIP-only photo batch: read all photos as one combined document via vision AI
// and generate test blocks directly (same block schema as the text path).
function buildVisionPrompt(photoCount: number) {
  return `Look at the ${photoCount} photo(s) provided — they show pages of study material (notes, a textbook, a worksheet, a slide, etc.), in the order given. Read all text visible across the photos as one combined document and generate structured test blocks for an e-learning platform.

Use ONLY these block types:
- CHOOSE_OPTION: question with options. Use "correctId": "o1" for ONE correct answer, or "correctId": ["o1","o3"] for MULTIPLE correct answers (when the source explicitly lists multiple correct answers, e.g. "A1 — 1,2,3")
- FREE_ANSWER: open-ended question requiring a written answer
- MATCH_PAIRS: matching left items to right items (3–6 pairs)
- INFO_TEXT: informational/context block (section header, instructions, definition)

Rules:
- Generate between 5 and 30 blocks depending on content visible
- Detect the language of the content and generate all questions in THAT SAME LANGUAGE
- For CHOOSE_OPTION: option ids must be "o1","o2",... — correctId is a string for single answer, string array for multiple
- For MATCH_PAIRS: pair ids must be "p1","p2",...
- For INFO_TEXT: preserve important context or section headings as plain text
- NEVER generate SEQUENCE, WORD_SCRAMBLE, DIALOGUE, HIGHLIGHT_TEXT blocks
- Include referenceAnswer in FREE_ANSWER whenever a model answer can be inferred
- If a photo is blurry or partially unreadable, use what you can still make out and ignore the rest

Return ONLY a valid JSON object {"blocks":[...]}:
{"blocks":[
  {"type":"CHOOSE_OPTION","payload":{"question":"...","options":[{"id":"o1","text":"..."},{"id":"o2","text":"..."},{"id":"o3","text":"..."}],"correctId":"o1"}},
  {"type":"FREE_ANSWER","payload":{"question":"...","referenceAnswer":"..."}},
  {"type":"MATCH_PAIRS","payload":{"pairs":[{"id":"p1","left":"...","right":"..."},{"id":"p2","left":"...","right":"..."}]}},
  {"type":"INFO_TEXT","payload":{"text":"..."}}
]}`
}

async function extractBlocksFromImages(files: File[]): Promise<{ blocks: unknown[]; usage: AIUsage }> {
  const images: { mimeType: string; base64: string }[] = []
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || EXT_TO_IMAGE_MIME[extOf(file.name)] || 'image/jpeg'
    images.push({ mimeType, base64: buf.toString('base64') })
  }

  const { content, usage } = await callVisionAI(
    'You are an expert educational test generator with vision. Return ONLY valid JSON, no markdown.',
    images,
    buildVisionPrompt(images.length),
    { temperature: 0.2 },
  )
  const parsed = parseJSON<{ blocks: unknown[] }>(content)
  return { blocks: normalizeBlocks(parsed.blocks ?? []), usage }
}

/** Merges usage from several AI calls into one for a single wallet charge — a
 * `null` entry (no usage reported, e.g. openrouter fallback) contributes $0
 * and is skipped, not treated as poisoning the whole sum. */
function sumUsage(list: AIUsage[]): AIUsage {
  const known = list.filter((u): u is NonNullable<AIUsage> => u !== null)
  if (known.length === 0) return null
  return known.reduce(
    (acc, u) => ({
      promptCacheHitTokens: acc.promptCacheHitTokens + u.promptCacheHitTokens,
      promptCacheMissTokens: acc.promptCacheMissTokens + u.promptCacheMissTokens,
      completionTokens: acc.completionTokens + u.completionTokens,
    }),
    { promptCacheHitTokens: 0, promptCacheMissTokens: 0, completionTokens: 0 },
  )
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

    const { role, email } = session.user as { id: string; role: string; email?: string | null }
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Teachers only' }, { status: 403 })
    }

    const isAdmin = role === 'ADMIN'
    const isVip = !isAdmin && email ? await resolveVip(email) : false
    const privileged = isAdmin || isVip
    const pageLimit = isAdmin ? Infinity : isVip ? VIP_PAGE_LIMIT : FREE_PAGE_LIMIT

    const formData = await req.formData()
    const fileEntries = (formData.getAll('files') as unknown[]).filter((f): f is File => f instanceof File)

    // Role-based file matrix (mirrors app/info-pdf-to-test's UploadModal):
    // free — unlimited PDFs, at most one doc-format (docx/txt/rtf/odt) file,
    // no photos; VIP/admin — everything, photos capped at MAX_PHOTOS.
    const pdfFiles: File[] = []
    const docFiles: File[] = []
    const imageFiles: File[] = []
    for (const f of fileEntries) {
      const kind = kindOf(f.name)
      if (kind === 'pdf') pdfFiles.push(f)
      else if (kind === 'doc') docFiles.push(f)
      else if (kind === 'image') imageFiles.push(f)
    }

    if (!privileged && imageFiles.length > 0) {
      return NextResponse.json(
        { error: 'Загрузка фото доступна только VIP пользователям', vipRequired: true },
        { status: 403 },
      )
    }
    if (!privileged && docFiles.length > 1) {
      return NextResponse.json(
        { error: 'На бесплатном тарифе DOCX, TXT, RTF и ODT — только один файл за раз', vipRequired: true },
        { status: 403 },
      )
    }
    if (privileged && imageFiles.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Можно загрузить не больше ${MAX_PHOTOS} фото за раз` }, { status: 400 })
    }

    const docLikeFiles = [...pdfFiles, ...docFiles]
    if (docLikeFiles.length === 0 && imageFiles.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    if (!pdfServiceUrl) return NextResponse.json({ error: 'PDF service not configured' }, { status: 503 })
    if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY)
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })

    console.log(`[import-pdf] Processing ${pdfFiles.length} pdf, ${docFiles.length} doc, ${imageFiles.length} image file(s)`)

    // Extract text-bearing files (pdf + doc) via microservice
    const results: (PdfExtractResult & { name: string })[] = []
    for (const file of pdfFiles) {
      try {
        results.push({ name: file.name, ...(await extractFromPdf(pdfServiceUrl, file)) })
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 })
      }
    }
    for (const file of docFiles) {
      try {
        results.push({ name: file.name, ...(await extractFromDocument(pdfServiceUrl, file)) })
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 })
      }
    }

    const totalPages = results.reduce((s, r) => s + r.pageCount, 0)
    if (totalPages > pageLimit) {
      return NextResponse.json(
        { error: 'PAGE_LIMIT_EXCEEDED', pageCount: totalPages, limit: pageLimit, isVip: privileged },
        { status: 422 },
      )
    }

    // Combine content: tables first (better structure), then text — no images
    const combinedContent = results
      .map((r) => {
        const header = results.length > 1 ? `=== DOCUMENT: ${r.name} ===\n` : ''
        const tablesSection = r.tablesText ? `TABLES:\n${r.tablesText}\n\nTEXT:\n` : ''
        return `${header}${tablesSection}${r.text}`
      })
      .join('\n\n')

    // All image blocks embedded inside pdf/doc files (prepended before AI blocks)
    const embeddedImageBlocks = results.flatMap((r) => r.imageBlocks)

    // ── Balance check — ADMIN pays like everyone else (billing has no role
    // exceptions; the pageLimit/format checks above are the only place ADMIN
    // still gets special treatment). ──
    const walletUser: WalletUser | null = await getWalletSessionUser()
    if (walletUser) {
      const promptChars = combinedContent.length + imageFiles.length * VISION_PROMPT_CHARS_PER_PHOTO
      try {
        await preflightCheck(walletUser, 'tests/import-pdf', promptChars, new Date())
      } catch (e) {
        if (e instanceof InsufficientBalanceError) {
          return NextResponse.json(
            {
              error: 'INSUFFICIENT_BALANCE',
              message: `Недостаточно средств: нужно ещё $${(e.neededCents / 100).toFixed(2)}`,
              neededCents: e.neededCents,
              availableCents: e.availableCents,
            },
            { status: 402 },
          )
        }
        throw e
      }
    }

    const usages: AIUsage[] = []

    let aiBlocks: unknown[] = []
    if (combinedContent.trim()) {
      const isUnlimited = isAdmin || isVip
      const SYSTEM = 'You are an expert educational test generator. Return ONLY valid JSON, no markdown.'

      if (isUnlimited && combinedContent.length > CHUNK_SIZE) {
        const chunks: string[] = []
        for (let i = 0; i < combinedContent.length; i += CHUNK_SIZE) chunks.push(combinedContent.slice(i, i + CHUNK_SIZE))
        const toProcess = chunks.slice(0, 8)
        console.log(`[import-pdf] VIP/ADMIN: ${toProcess.length} chunk(s)`)
        for (let i = 0; i < toProcess.length; i++) {
          console.log(`[import-pdf] AI chunk ${i + 1}/${toProcess.length}: asking...`)
          const { content, usage } = await callAI(SYSTEM, buildPrompt(toProcess[i], i, toProcess.length, docLikeFiles.length), { temperature: 0.2 })
          usages.push(usage)
          const parsed = parseJSON<{ blocks: unknown[] }>(content)
          aiBlocks.push(...normalizeBlocks(parsed.blocks ?? []))
          console.log(`[import-pdf] AI chunk ${i + 1}/${toProcess.length}: ${parsed.blocks?.length ?? 0} block(s)`)
        }
      } else {
        console.log(`[import-pdf] AI: asking for blocks from ${combinedContent.length} char(s)...`)
        const { content, usage } = await callAI(SYSTEM, buildPrompt(combinedContent.slice(0, CHUNK_SIZE), 0, 1, docLikeFiles.length), { temperature: 0.2 })
        usages.push(usage)
        const parsed = parseJSON<{ blocks: unknown[] }>(content)
        aiBlocks = normalizeBlocks(parsed.blocks ?? [])
        console.log(`[import-pdf] AI: ${aiBlocks.length} block(s) generated`)
      }
    }

    // VIP/admin photo batch — read via vision AI straight into test blocks
    let visionBlocks: unknown[] = []
    if (imageFiles.length > 0) {
      try {
        console.log(`[import-pdf] vision AI: analyzing ${imageFiles.length} photo(s)...`)
        const result = await extractBlocksFromImages(imageFiles)
        visionBlocks = result.blocks
        usages.push(result.usage)
        console.log(`[import-pdf] vision AI: ${visionBlocks.length} block(s) generated`)
      } catch (err) {
        console.error('[import-pdf] vision AI error:', err)
        return NextResponse.json({ error: (err as Error).message }, { status: 502 })
      }
    }

    // Images go first so the teacher sees them before questions
    const blocks = [...embeddedImageBlocks, ...aiBlocks, ...visionBlocks]

    console.log(`[import-pdf] done — ${blocks.length} block(s) total, ${totalPages} page(s)`)

    // Charge only after every AI call above succeeded (R03.1) — any thrown
    // error returns before this line, so a failed call never reaches the
    // wallet. One aggregated charge across all chunks/vision for this request.
    let chargedCents = 0
    if (walletUser) {
      chargedCents = (await chargeForAICall(walletUser, 'tests/import-pdf', sumUsage(usages), new Date())).costCents
    }

    return NextResponse.json({ blocks, pageCount: totalPages, isVip: privileged, chargedCents })
  } catch (error) {
    console.error('[POST /api/tests/import-pdf]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
