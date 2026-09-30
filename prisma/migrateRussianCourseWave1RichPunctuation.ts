/**
 * Idempotent quality pass over the 7 «Пунктуация» topics seeded by
 * prisma/seedRussianCourse04Punctuation.ts (ticket 04, .autopilot/russian-course/):
 *
 * 1. Rewrites each post's TEXT block into genuinely well-written Russian prose using
 *    headings/bold/italic/blockquote/lists/tables (the InfoTextEditor now supports
 *    Table/TableRow/TableHeader/TableCell on top of StarterKit — see
 *    src/features/BlockEditors/InfoTextEditor/InfoTextEditor.tsx).
 * 2. Regenerates cover images with a compression fix (bycom.by has no smaller `size`
 *    param — see D01 below — so compression happens client-side via `sharp`, already
 *    in node_modules as a transitive Next.js dependency, no new install), uploaded to
 *    a new `russian-course-images-v3` S3 folder.
 * 3. Redesigns the cheat-sheet PDFs: colored header band + a real ruled 2-column
 *    table (rule/example) drawn manually with pdf-lib primitives, uploaded to a new
 *    `russian-course-cheatsheets-v2` folder.
 * 4. Fixes the FILL_TEXT bug: the original seed created ONE block per single gap
 *    (e.g. 17 near-identical "Заполните пропуски" blocks in the quotation-marks large
 *    test). `extractGaps` in src/features/Tasks/TaskResult/scoreBlock.tsx walks the
 *    whole tiptap doc recursively, and FillTextEditor.tsx renders one continuous
 *    editor per block — so a single FILL_TEXT block can hold many PARAGRAPHS, each
 *    with its own embedded inputGap nodes. Fixed by mechanically regrouping the
 *    existing (already well-written) sentences from quotation-marks/comma-isolation
 *    into few multi-paragraph blocks instead of many single-sentence blocks — no new
 *    sentences needed, this was purely a structural bug.
 * 5. Adds MATCH_PAIRS/DIALOGUE blocks to the large test of every topic for variety
 *    (read src/features/Tasks/TaskObjects/{DialogueTask,MatchPairsTask}.tsx and
 *    scoreBlock.tsx first — MATCH_PAIRS scores each pair's `id` against itself
 *    (left[i]/right[i] share one id, shuffled independently in the UI); DIALOGUE
 *    scores the submitted line-id order against `payload.lines` order as stored).
 *
 * No `src/` import at runtime (production image doesn't ship `src/` — see
 * prisma/migrateRussianCourseWave1.ts / migrateRussianCourseWave1CoverRefresh.ts,
 * bitten by this twice already): S3 client rebuilt inline, block `type` fields are
 * plain string literals, never an enum import.
 *
 * Idempotency — three independent per-topic markers (checked separately so a partial
 * external failure, e.g. no bycom.by credits, doesn't block the free-to-redo parts):
 *   - cover:   Post's MEDIA block url already contains 'russian-course-images-v3'
 *   - content: Post's FILE_LIST url already contains 'russian-course-cheatsheets-v2'
 *              (gates both the TEXT rewrite and the PDF regen — they ship together)
 *   - tests:   Test.content.richVersion === TEST_RICH_VERSION
 * A second run against a fully-processed DB is a clean no-op on all three.
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1RichPunctuation.ts
 * Self-check only (no DB/network): npx tsx prisma/migrateRussianCourseWave1RichPunctuation.ts --selfcheck
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import assert from 'assert'
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {PDFDocument, PDFFont, PDFPage, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import sharp from 'sharp'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const COVER_FOLDER = 'russian-course-images-v3'
const OLD_COVER_FOLDER_MARKERS = ['russian-course-images-v3'] // presence of this = already done
const CHEATSHEET_FOLDER = 'russian-course-cheatsheets-v2'
const TEST_RICH_VERSION = 'punctuation-rich-v1'

const BYCOM_API_KEY = process.env.BYCOM_API_KEY
const IMAGE_MODEL = 'z-image-turbo' // 0.03 BYN/картинку, дефолт по interfaces.md §5

// ───────────────────────── S3 (inline, no src/ import) ─────────────────────────

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  }
})
const S3_BUCKET = process.env.S3_BUCKET!

function publicUrlForKey(key: string): string {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL
  if (!base) throw new Error('NEXT_PUBLIC_S3_PUBLIC_URL is not set')
  return `${base.replace(/\/$/, '')}/${key}`
}

async function uploadBuffer(buffer: Buffer, folder: string, ext: string, teacherId: string, contentType: string) {
  const key = `${folder}/${teacherId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType}))
  return publicUrlForKey(key)
}

// ───────────────────────── small id helper ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc04r-${Date.now()}-${++_uidCounter}`
}

// ───────────────────────── tiptap rich-doc builders (TEXT block) ─────────────────────────

function tnode(text: string, marks?: ('bold' | 'italic')[]) {
  return marks?.length ? {type: 'text', text, marks: marks.map((m) => ({type: m}))} : {type: 'text', text}
}
function b(text: string) {
  return tnode(text, ['bold'])
}
function i(text: string) {
  return tnode(text, ['italic'])
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function p(...parts: (string | any)[]) {
  return {type: 'paragraph', content: parts.map((x) => (typeof x === 'string' ? tnode(x) : x))}
}
function h2(text: string) {
  return {type: 'heading', attrs: {level: 2}, content: [tnode(text)]}
}
function h3(text: string) {
  return {type: 'heading', attrs: {level: 3}, content: [tnode(text)]}
}
function bq(...paragraphs: string[]) {
  return {type: 'blockquote', content: paragraphs.map((s) => p(s))}
}
function ul(items: string[]) {
  return {type: 'bulletList', content: items.map((s) => ({type: 'listItem', content: [p(s)]}))}
}
function ol(items: string[]) {
  return {type: 'orderedList', content: items.map((s) => ({type: 'listItem', content: [p(s)]}))}
}
function tableNode(header: string[], rows: string[][]) {
  const cell = (text: string, isHeader: boolean) => ({type: isHeader ? 'tableHeader' : 'tableCell', content: [p(text)]})
  return {
    type: 'table',
    content: [{type: 'tableRow', content: header.map((h) => cell(h, true))}, ...rows.map((r) => ({type: 'tableRow', content: r.map((c) => cell(c, false))}))]
  }
}
function richDoc(...blocks: object[]) {
  return {type: 'doc', content: blocks}
}

// ───────────────────────── FILL_TEXT (multi-paragraph, the actual bug fix) ─────────────────────────

type FillPart = string | {gap: string}

function fillParagraph(parts: FillPart[]) {
  const content: Record<string, unknown>[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      if (part) content.push({type: 'text', text: part})
    } else {
      content.push({type: 'inputGap', attrs: {gapId: uid(), answer: part.gap}})
    }
  }
  return {type: 'paragraph', content}
}

// One block == one coherent multi-sentence exercise (several paragraphs, each with its
// own gaps) — NOT one block per single gap, which was the bug (see file header).
function fillTextBlock(paragraphs: FillPart[][]) {
  return {
    id: uid(),
    type: 'FILL_TEXT',
    payload: {content: richDoc(...paragraphs.map(fillParagraph))}
  }
}

// ───────────────────────── variety blocks (DIALOGUE / MATCH_PAIRS) ─────────────────────────

function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {id: uid(), type: 'MATCH_PAIRS', payload: {pairs: pairs.map((pr) => ({id: uid(), left: pr.left, right: pr.right}))}}
}

function dialogueBlock(instruction: string, speakers: {a: string; b: string}, lines: {speaker: 'a' | 'b'; text: string}[]) {
  return {
    id: uid(),
    type: 'DIALOGUE',
    payload: {instruction, speakers, lines: lines.map((l) => ({id: uid(), speaker: l.speaker, text: l.text}))}
  }
}

// ───────────────────────── images: generate + compress ─────────────────────────

async function generateCoverImagePng(prompt: string): Promise<Buffer> {
  if (!BYCOM_API_KEY) throw new Error('BYCOM_API_KEY is not set in .env')
  const res = await fetch('https://api.bycom.by/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${BYCOM_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: IMAGE_MODEL, prompt, n: 1, size: '1024x1024'})
  })
  if (!res.ok) throw new Error(`bycom.by image generation failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {data?: {b64_json?: string}[]}
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error(`bycom.by response missing data[0].b64_json: ${JSON.stringify(json).slice(0, 300)}`)
  return Buffer.from(b64, 'base64')
}

// D01: `GET /v1/models` for flux-2-klein-4b/z-image-turbo lists only `n` as a tunable
// parameter (`per_size_quality` has exactly one key, "1024x1024_standard") — the API
// itself does not accept a smaller `size` or a `response_format`/quality param
// (verified live 2026-09-28, not guessed). The 1-1.5MB baseline is a 1024×1024 PNG;
// compression has to happen after the fact. `sharp` is already in node_modules
// (transitive Next.js dep, confirmed via `node -e "require('sharp').versions"`) — no
// new dependency. Downscale to 768×768 (still plenty for a post cover thumbnail) and
// re-encode as JPEG q78/mozjpeg — PNG is the wrong format for a photographic/gradient
// poster image to begin with, this alone is most of the win.
async function compressCover(pngBuffer: Buffer): Promise<Buffer> {
  return sharp(pngBuffer).resize(768, 768, {fit: 'cover'}).jpeg({quality: 78, mozjpeg: true}).toBuffer()
}

// ───────────────────────── PDF: redesigned cheat sheet (pdf-lib, manual table) ─────────────────────────

const A4: [number, number] = [595.28, 841.89]
const ACCENT: [number, number, number] = [0.13, 0.28, 0.53] // one accent used for header band + table header row
const ACCENT_SOFT: [number, number, number] = [0.93, 0.95, 0.99]

async function loadFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit)
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf')),
    fs.readFile(path.join(process.cwd(), 'public/fonts/Roboto-Bold.ttf'))
  ])
  return {regular: await pdfDoc.embedFont(regularBytes), bold: await pdfDoc.embedFont(boldBytes)}
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word
    if (current && font.widthOfTextAtSize(attempt, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = attempt
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawHeaderBand(page: PDFPage, title: string, subtitle: string, fonts: {regular: PDFFont; bold: PDFFont}) {
  const bandHeight = 100
  page.drawRectangle({x: 0, y: A4[1] - bandHeight, width: A4[0], height: bandHeight, color: rgb(...ACCENT)})
  let y = A4[1] - 44
  for (const line of wrapText(title, fonts.bold, 21, A4[0] - 100)) {
    page.drawText(line, {x: 50, y, size: 21, font: fonts.bold, color: rgb(1, 1, 1)})
    y -= 26
  }
  page.drawText(subtitle, {x: 50, y: A4[1] - bandHeight + 14, size: 10, font: fonts.regular, color: rgb(0.82, 0.88, 0.98)})
}

// Real ruled 2-column table drawn by hand (pdf-lib has no table primitive) — header
// row filled with the accent color, data rows bordered, column divider drawn with
// drawLine. Returns the y position after the table so the caller can keep drawing.
function drawTable(
  page: PDFPage,
  x: number,
  yStart: number,
  width: number,
  header: [string, string],
  rows: [string, string][],
  fonts: {regular: PDFFont; bold: PDFFont}
): number {
  const col1W = width * 0.4
  const col2W = width - col1W
  const pad = 8
  const lineH = 13
  let y = yStart

  const allRows = [{a: header[0], b: header[1], isHeader: true}, ...rows.map(([a, c]) => ({a, b: c, isHeader: false}))]

  for (const row of allRows) {
    const font = row.isHeader ? fonts.bold : fonts.regular
    const size = row.isHeader ? 11 : 10.5
    const linesA = wrapText(row.a, font, size, col1W - pad * 2)
    const linesB = wrapText(row.b, font, size, col2W - pad * 2)
    const lineCount = Math.max(linesA.length, linesB.length, 1)
    const rowH = lineCount * lineH + pad * 2

    page.drawRectangle({
      x,
      y: y - rowH,
      width,
      height: rowH,
      color: row.isHeader ? rgb(...ACCENT) : rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.85, 0.88),
      borderWidth: 0.6
    })
    const textColor = row.isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.12, 0.15)
    linesA.forEach((l, idx) => page.drawText(l, {x: x + pad, y: y - pad - 10 - idx * lineH, size, font, color: textColor}))
    linesB.forEach((l, idx) => page.drawText(l, {x: x + col1W + pad, y: y - pad - 10 - idx * lineH, size, font, color: textColor}))
    page.drawLine({start: {x: x + col1W, y}, end: {x: x + col1W, y: y - rowH}, thickness: 0.6, color: rgb(0.85, 0.85, 0.88)})

    y -= rowH
  }
  return y
}

async function buildCheatSheetPdfV2(title: string, summary: string, rows: [string, string][]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const marginX = 50
  const maxWidth = A4[0] - marginX * 2

  drawHeaderBand(page, title, 'ШПАРГАЛКА', fonts)

  let y = A4[1] - 100 - 34
  for (const line of wrapText(summary, fonts.regular, 12, maxWidth)) {
    page.drawText(line, {x: marginX, y, size: 12, font: fonts.regular, color: rgb(0.2, 0.2, 0.24)})
    y -= 17
  }
  y -= 18

  page.drawText('ПРАВИЛА И ПРИМЕРЫ', {x: marginX, y, size: 11, font: fonts.bold, color: rgb(...ACCENT)})
  y -= 16

  drawTable(page, marginX, y, maxWidth, ['Правило', 'Пример'], rows, fonts)

  return Buffer.from(await pdfDoc.save())
}

async function buildSummaryPdfV2(title: string, items: {name: string; line: string}[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const marginX = 50
  const maxWidth = A4[0] - marginX * 2

  drawHeaderBand(page, title, 'СВОДНЫЙ УКАЗАТЕЛЬ ТЕМ', fonts)

  let y = A4[1] - 100 - 34
  drawTable(
    page,
    marginX,
    y,
    maxWidth,
    ['Тема', 'Суть правила'],
    items.map((it) => [it.name, it.line] as [string, string]),
    fonts
  )
  return Buffer.from(await pdfDoc.save())
}

// ───────────────────────── self-check (no DB/network needed) ─────────────────────────

async function selfCheck() {
  // 1. FILL_TEXT: multiple paragraphs, each with its own gaps, land in one doc — this
  // is the actual bug fix, assert the shape extractGaps()/FillTextEditor expect.
  const block = fillTextBlock([
    ['A', {gap: '1'}, 'B'],
    [{gap: '2'}, 'C', {gap: '3'}]
  ])
  const doc = (block.payload as {content: {type: string; content: unknown[]}}).content
  assert.strictEqual(doc.type, 'doc')
  assert.strictEqual(doc.content.length, 2, 'expected 2 paragraphs in one FILL_TEXT block')
  const gapCount = JSON.stringify(doc).match(/"inputGap"/g)?.length ?? 0
  assert.strictEqual(gapCount, 3, 'expected 3 inputGap nodes across the 2 paragraphs')

  // 2. rich TEXT doc builders produce nodes the InfoTextEditor schema recognizes.
  const rdoc = richDoc(h2('T'), p('x', b('bold'), i('italic')), bq('quoted'), tableNode(['H1', 'H2'], [['a', 'b']]))
  assert.strictEqual(rdoc.type, 'doc')
  assert.ok(JSON.stringify(rdoc).includes('"type":"bold"'))
  assert.ok(JSON.stringify(rdoc).includes('"type":"blockquote"'))
  assert.ok(JSON.stringify(rdoc).includes('"type":"table"'))

  // 3. image compression: synthetic 1024x1024 PNG (gradient + text, so it isn't a
  // trivially-tiny solid color to begin with) -> compressCover() must shrink it and
  // produce a real JPEG.
  const synthetic = await sharp({
    create: {width: 1024, height: 1024, channels: 3, background: {r: 120, g: 80, b: 200}}
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffcc00"/><stop offset="1" stop-color="#3355ff"/>
          </linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>
          <circle cx="512" cy="512" r="300" fill="#ffffff" opacity="0.4"/></svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer()
  const compressed = await compressCover(synthetic)
  assert.ok(compressed.length > 0, 'compressCover produced an empty buffer')
  assert.ok(compressed.length < synthetic.length, 'compressed image is not smaller than the source PNG')
  assert.strictEqual(compressed[0], 0xff, 'compressed output is not a JPEG (SOI marker)')
  assert.strictEqual(compressed[1], 0xd8, 'compressed output is not a JPEG (SOI marker)')

  // 4. PDF table renderer produces a non-trivial, valid PDF.
  const pdf = await buildCheatSheetPdfV2('Тест — шпаргалка', 'Краткое правило.', [
    ['Правило A', 'Пример A'],
    ['Правило B (подлиннее, чтобы проверить перенос строк по ширине колонки)', 'Пример B']
  ])
  assert.ok(pdf.length > 1000, 'generated PDF looks too small to be real')
  assert.strictEqual(pdf.subarray(0, 5).toString('latin1'), '%PDF-', 'not a valid PDF header')

  console.log(
    `selfcheck OK — fill_text: 2 paragraphs/3 gaps in 1 block; rich doc: bold/blockquote/table present; ` +
      `cover: PNG ${synthetic.length}B -> JPEG ${compressed.length}B (${Math.round((1 - compressed.length / synthetic.length) * 100)}% smaller); ` +
      `pdf: ${pdf.length}B valid header.`
  )
}

// ───────────────────────── topic content ─────────────────────────

interface RichTopic {
  slug: string
  postTitle: string // must match the title seedRussianCourse04Punctuation.ts created
  richText: object
  cheatSheetTitle: string
  cheatSheetSummary: string
  cheatSheetRows: [string, string][]
  coverPrompt: string
  shortTestTitle: string
  largeTestTitle: string
  // only set for the two FILL_TEXT topics (the actual bug) — mechanical regroup of
  // the ALREADY-WRITTEN sentences from the original seed into few multi-paragraph
  // blocks instead of many single-sentence blocks.
  fillTextRebuild?: {short: FillPart[][]; large: FillPart[][][]}
  varietyForLargeTest: () => object
}

const TOPICS: RichTopic[] = [
  // ───────────── commas ─────────────
  {
    slug: 'commas',
    postTitle: 'Запятые: главные правила расстановки',
    richText: richDoc(
      h2('Запятая — самый частый знак и самый частый источник ошибок'),
      p(
        'Правило здесь не одно, а ',
        b('восемь ситуаций'),
        ', которые нужно научиться узнавать в тексте с первого взгляда. Разберём их по порядку — от однородных членов до вводных слов.'
      ),
      h3('Однородные члены'),
      p('Если союза между ними нет вовсе, между однородными членами всегда стоит запятая:'),
      bq('На поляне росли ромашки, васильки и колокольчики.'),
      p(
        'А вот с союзом важен нюанс: ',
        b('одиночный'),
        ' союз ',
        i('и/или/либо'),
        ' запятой не требует —'
      ),
      bq('Дети играли во дворе и весело смеялись.'),
      p(
        'Но если союз ',
        i('повторяется'),
        ' (и…и, или…или, ни…ни), запятая ставится перед каждым, начиная со второго. А союзы ',
        b('а, но, однако'),
        ' между однородными членами требуют запятой всегда, без исключений.'
      ),
      bq('И ромашки, и васильки цвели на лугу.', 'Ветер стих, но волны ещё бились.'),
      h3('Границы частей сложного предложения'),
      p(
        'Здесь работают два разных правила. В ',
        b('сложносочинённом'),
        ' предложении (части равноправны, союзы и, а, но, да, зато) запятая ставится перед союзом. В ',
        b('сложноподчинённом'),
        ' — на границе главной и придаточной части, перед словами что, чтобы, если, потому что, который.'
      ),
      bq('Мама позвала меня, и я побежал домой.', 'Мы знали, что экзамен будет трудным.'),
      h3('Обособленные обороты, вводные слова и обращения'),
      p(
        'Причастный и деепричастный оборот выделяются запятыми — с двух сторон, если стоят в середине предложения, или одной, если в начале или в конце. Вводные слова и обращения выделяются запятыми независимо от места в предложении.'
      ),
      bq('Дом, стоявший на холме, был виден издалека.', 'Конечно, мы поможем тебе.', 'Ребята, приготовьтесь к старту.'),
      tableNode(
        ['Ситуация', 'Нужна ли запятая'],
        [
          ['Один союз и/или/либо', 'Нет'],
          ['Союзы а, но, однако между однородными членами', 'Да, всегда'],
          ['Повторяющийся союз и…и…', 'Да, перед каждым, начиная со второго'],
          ['Вводное слово или обращение', 'Да, в любом месте предложения']
        ]
      )
    ),
    cheatSheetTitle: 'Запятые: главные правила',
    cheatSheetSummary: 'Запятая — самый частый знак: однородные члены, границы частей сложного предложения, обособленные обороты и вводные слова/обращения.',
    cheatSheetRows: [
      ['Однородные члены без союзов', 'На поляне росли ромашки, васильки и колокольчики.'],
      ['Одиночный союз и/или/либо — запятая не нужна', 'Дети играли и весело смеялись.'],
      ['Союзы а, но, однако — запятая всегда', 'Ветер стих, но волны ещё бились.'],
      ['Повторяющийся союз и…и…', 'И ромашки, и васильки цвели на лугу.'],
      ['Граница частей ССП перед союзом', 'Мама позвала меня, и я побежал домой.'],
      ['Граница главной и придаточной части СПП', 'Мы знали, что экзамен будет трудным.'],
      ['Обособленный оборот', 'Дом, стоявший на холме, был виден издалека.'],
      ['Вводное слово / обращение', 'Конечно, мы поможем тебе.']
    ],
    coverPrompt: 'Warm editorial close-up photo of a red pencil marking small dots on a handwritten notebook page, soft daylight, cozy study atmosphere, no readable text',
    shortTestTitle: 'Запятые: короткая проверка',
    largeTestTitle: 'Запятые: большой тест на расстановку',
    varietyForLargeTest: () =>
      matchPairsBlock([
        {left: 'Повторяющийся союз и…и', right: 'И ромашки, и васильки цвели на лугу.'},
        {left: 'Граница частей ССП перед союзом', right: 'Мама позвала меня, и я побежал домой.'},
        {left: 'Граница главной и придаточной части СПП', right: 'Мы знали, что экзамен будет трудным.'},
        {left: 'Вводное слово / обращение', right: 'Конечно, мы поможем тебе.'}
      ])
  },

  // ───────────── colon ─────────────
  {
    slug: 'colon',
    postTitle: 'Двоеточие: когда ставится и как проверить',
    richText: richDoc(
      h2('Проверка на «а именно»'),
      p(
        'Двоеточие сигнализирует, что дальше идёт раскрытие, разъяснение или прямая цитата того, о чём было сказано в первой части. Есть простая опорная проверка: попробуйте мысленно вставить между частями слова ',
        i('«а именно»'),
        ', ',
        i('«потому что»'),
        ' или ',
        i('«и увидел, что»'),
        ' — если по смыслу подходит, нужно двоеточие.'
      ),
      h3('Четыре случая'),
      p(b('Обобщающее слово перед однородными членами'), ' — дальше идёт их перечисление:'),
      bq('В корзине лежали фрукты: яблоки, груши, сливы.'),
      p(
        b('Бессоюзное сложное предложение, причина'),
        ' (проверка «потому что») и ',
        b('пояснение'),
        ' (проверка «а именно»):'
      ),
      bq('Я не пошёл гулять: начался дождь.', 'Оглянулся: никого не было.'),
      p(b('Слова автора перед прямой речью'), ' — схема одна и та же во всех случаях: первая часть указывает, что дальше последует раскрытие.'),
      bq('Он сказал: «Я вернусь поздно».'),
      tableNode(
        ['Случай', 'Проверка / пример'],
        [
          ['Обобщающее слово', '«а именно» → В корзине лежали фрукты: яблоки, груши, сливы.'],
          ['БСП, причина', '«потому что» → Я не пошёл гулять: начался дождь.'],
          ['БСП, пояснение', '«а именно» → Оглянулся: никого не было.'],
          ['Слова автора перед прямой речью', 'Он сказал: «Я вернусь поздно».']
        ]
      )
    ),
    cheatSheetTitle: 'Двоеточие',
    cheatSheetSummary: 'Двоеточие — перед перечислением после обобщающего слова, перед причиной/пояснением в БСП и перед прямой речью после слов автора.',
    cheatSheetRows: [
      ['Обобщающее слово перед перечислением', 'В корзине лежали фрукты: яблоки, груши, сливы.'],
      ['БСП — причина (=потому что)', 'Я не пошёл гулять: начался дождь.'],
      ['БСП — пояснение (=а именно)', 'Оглянулся: никого не было.'],
      ['Слова автора перед прямой речью', 'Он сказал: «Я вернусь поздно».']
    ],
    coverPrompt: 'Minimalist still life of a black fountain pen and an open notebook on a wooden desk, warm soft light, cozy academic mood, no readable text',
    shortTestTitle: 'Двоеточие: короткая проверка',
    largeTestTitle: 'Двоеточие: большой тест',
    varietyForLargeTest: () =>
      matchPairsBlock([
        {left: 'Обобщающее слово перед перечислением', right: 'В корзине лежали фрукты: яблоки, груши, сливы.'},
        {left: 'БСП, причина (=потому что)', right: 'Я не пошёл гулять: начался дождь.'},
        {left: 'БСП, пояснение (=а именно)', right: 'Оглянулся: никого не было.'},
        {left: 'Прямая речь после слов автора', right: 'Он сказал: «Я вернусь поздно».'}
      ])
  },

  // ───────────── dash ─────────────
  {
    slug: 'dash',
    postTitle: 'Тире: когда ставится и когда — нет',
    richText: richDoc(
      h2('Тире между равноправными частями'),
      p(
        'Тире, в отличие от двоеточия, чаще ставится между равноправными частями или на месте пропущенного слова. Разберём, когда оно нужно, а когда — нет, несмотря на то что пауза в предложении как будто есть.'
      ),
      p(
        'Если подлежащее и сказуемое выражены существительными или числительными в именительном падеже без связки — ставится тире:'
      ),
      bq('Москва — столица России.'),
      p(
        'Но тире ',
        b('не ставится'),
        ', если перед сказуемым есть отрицание ',
        i('«не»'),
        ' или сравнительный союз (как, будто, словно):'
      ),
      bq('Бедность не порок.', 'Этот сад как рай.'),
      h3('Неполное предложение и бессоюзная связь'),
      p('В неполном предложении, где пропущено слово и это ясно из параллельной конструкции, на месте пропуска ставится тире:'),
      bq('Слева — лес, справа — поле.'),
      p(
        'В бессоюзном сложном предложении тире ставится при ',
        b('противопоставлении'),
        ' (проверка «а») и при ',
        b('следствии'),
        ' или быстрой смене событий (проверка «поэтому»/«и вдруг»):'
      ),
      bq('Труд человека кормит — лень портит.', 'Ударил мороз — река стала.'),
      p('В диалоге тире ставится перед репликой с новой строки и после реплики перед словами автора:'),
      bq('«Идём!» — скомандовал капитан.'),
      tableNode(
        ['Есть тире', 'Нет тире'],
        [
          ['Москва — столица России.', 'Бедность не порок.'],
          ['Слева — лес, справа — поле.', 'Этот сад как рай.'],
          ['Труд человека кормит — лень портит.', '—']
        ]
      )
    ),
    cheatSheetTitle: 'Тире',
    cheatSheetSummary: 'Тире — между подлежащим и сказуемым-существительными, на месте пропуска слова, в БСП с противопоставлением/следствием и в диалоге.',
    cheatSheetRows: [
      ['Подлежащее и сказуемое — существительные', 'Москва — столица России.'],
      ['Тире НЕ ставится с «не» или «как/будто/словно»', 'Бедность не порок. Этот сад как рай.'],
      ['Неполное предложение (пропуск слова)', 'Слева — лес, справа — поле.'],
      ['БСП — противопоставление', 'Труд человека кормит — лень портит.'],
      ['БСП — следствие / быстрая смена событий', 'Ударил мороз — река стала.'],
      ['Диалог: реплика и слова автора', '«Идём!» — скомандовал капитан.']
    ],
    coverPrompt: 'Editorial photo of a long shadow cast by a wooden ruler across lined paper on a desk, warm afternoon light, minimalist composition, no readable text',
    shortTestTitle: 'Тире: короткая проверка',
    largeTestTitle: 'Тире: большой тест',
    varietyForLargeTest: () =>
      matchPairsBlock([
        {left: 'Подлежащее и сказуемое — существительные', right: 'Москва — столица России.'},
        {left: 'Неполное предложение (пропуск слова)', right: 'Слева — лес, справа — поле.'},
        {left: 'БСП — противопоставление', right: 'Труд человека кормит — лень портит.'},
        {left: 'БСП — следствие', right: 'Ударил мороз — река стала.'}
      ])
  },

  // ───────────── quotation-marks (FILL_TEXT bug fix here) ─────────────
  {
    slug: 'quotation-marks',
    postTitle: 'Кавычки: прямая речь, цитаты и особые случаи',
    richText: richDoc(
      h2('«Ёлочки» — стандартный парный знак'),
      p(
        'Кавычки выделяют чужую речь, буквально переданную на письме, от собственной речи говорящего или пишущего. В русском письме стандартный парный знак — «ёлочки»: ',
        i('« и »'),
        '.'
      ),
      h3('Прямая речь и цитаты'),
      p('Прямая речь после слов автора оформляется по схеме А: «П».'),
      bq('Он сказал: «Я вернусь поздно».'),
      p('Если прямая речь стоит перед словами автора, схема другая — «П», — а.'),
      bq('«Мы опоздаем», — сказала мама.'),
      p('Цитаты оформляются так же, как прямая речь: заключаются в кавычки с сохранением пунктуации автора.'),
      h3('Переносное значение и названия'),
      p(
        'Отдельное слово или сочетание слов, употреблённое в ',
        b('переносном или ироничном'),
        ' значении, тоже берётся в кавычки. Так же в кавычки заключаются названия книг, фильмов, журналов и организаций.'
      ),
      bq('Друзья называли его «профессором» за любовь к чтению.', 'Мы читали роман «Война и мир».'),
      ul([
        'Прямая речь после слов автора — А: «П».',
        'Прямая речь перед словами автора — «П», — а.',
        'Слово в переносном/ироничном значении — в кавычках.',
        'Названия книг, фильмов, журналов, организаций — в кавычках.'
      ])
    ),
    cheatSheetTitle: 'Кавычки',
    cheatSheetSummary: 'Кавычки — вокруг прямой речи и цитат, вокруг слова в переносном/ироничном значении и вокруг названий.',
    cheatSheetRows: [
      ['Прямая речь после слов автора', 'Он сказал: «Я вернусь поздно».'],
      ['Прямая речь перед словами автора', '«Мы опоздаем», — сказала мама.'],
      ['Слово в переносном/ироничном значении', 'Друзья называли его «профессором».'],
      ['Названия книг, фильмов, журналов', 'Роман «Война и мир».']
    ],
    coverPrompt: 'Warm editorial photo of an open book on a wooden table, soft daylight, cozy reading nook atmosphere, no readable text',
    shortTestTitle: 'Кавычки: короткая проверка',
    largeTestTitle: 'Кавычки: большой тест',
    // Mechanical regroup of the ORIGINAL 6/12 single-sentence blocks (verbatim, already
    // well-written) into few multi-paragraph blocks — fixes the "pile of near-identical
    // prompts" bug without inventing new sentences.
    fillTextRebuild: {
      short: [
        ['Она сказала: ', {gap: '«'}, 'Уже поздно', {gap: '»'}, '.'],
        [{gap: '«'}, 'Мы опоздаем', {gap: '»'}, ', — сказала мама.'],
        ['Друзья называли его ', {gap: '«'}, 'профессором', {gap: '»'}, ' за любовь к чтению.'],
        ['Мы читали роман ', {gap: '«'}, 'Война и мир', {gap: '»'}, '.'],
        ['Учитель произнёс: ', {gap: '«'}, 'Тишина в классе', {gap: '»'}, '.'],
        ['Она гордо называла себя ', {gap: '«'}, 'звездой', {gap: '»'}, ' двора.']
      ],
      large: [
        [
          ['Отец спросил: ', {gap: '«'}, 'Ты готов', {gap: '»'}, '?'],
          [{gap: '«'}, 'Пора идти', {gap: '»'}, ', — произнёс он тихо.'],
          ['В сочинении он процитировал Пушкина: ', {gap: '«'}, 'Я вас любил', {gap: '»'}, '.'],
          ['Мы посмотрели фильм ', {gap: '«'}, 'Приключение', {gap: '»'}, ' в субботу.'],
          ['Хвастун важно называл себя ', {gap: '«'}, 'гением', {gap: '»'}, '.'],
          ['Директор сказал: ', {gap: '«'}, 'Собрание начнётся в три', {gap: '»'}, '.']
        ],
        [
          [{gap: '«'}, 'Осторожно, лёд', {gap: '»'}, ', — предупредил тренер.'],
          ['В журнале ', {gap: '«'}, 'Вокруг света', {gap: '»'}, ' вышла новая статья.'],
          ['Соседка снова назвала кота ', {gap: '«'}, 'разбойником', {gap: '»'}, '.'],
          ['Экскурсовод произнёс: ', {gap: '«'}, 'Перед вами древний замок', {gap: '»'}, '.'],
          [{gap: '«'}, 'Идём домой', {gap: '»'}, ', — сказала бабушка.'],
          ['Мы изучали повесть ', {gap: '«'}, 'Капитанская дочка', {gap: '»'}, '.']
        ]
      ]
    },
    varietyForLargeTest: () =>
      dialogueBlock('Расставьте реплики диалога в правильном порядке.', {a: 'Аня', b: 'Максим'}, [
        {speaker: 'a', text: 'Максим, ты прочитал книгу, которую я советовала?'},
        {speaker: 'b', text: 'Да, «Капитанскую дочку». Учитель ещё сказал: «Это лучший роман Пушкина».'},
        {speaker: 'a', text: 'А тебе она понравилась?'},
        {speaker: 'b', text: 'Очень! Особенно момент, где герой говорит: «Береги честь смолоду».'}
      ])
  },

  // ───────────── comma-isolation (FILL_TEXT bug fix here) ─────────────
  {
    slug: 'comma-isolation',
    postTitle: 'Обособленные члены предложения: когда нужна запятая',
    richText: richDoc(
      h2('Обособление — это выделение запятыми'),
      p(
        'Обособление подчёркивает смысловую и интонационную самостоятельность второстепенного члена предложения. Ниже — сводная шпаргалка: ',
        b('когда именно'),
        ' нужна запятая, без подробного разбора грамматической природы каждого оборота — та разбирается отдельно в теме «Обособленные члены» блока «Синтаксис».'
      ),
      tableNode(
        ['Тип оборота', 'Когда обособляется', 'Пример'],
        [
          ['Согласованное определение', 'После определяемого слова', 'Дом, стоявший на холме, был виден издалека.'],
          ['Определение перед словом', 'С добавочным значением причины/уступки', 'Уставший, он всё же дошёл до дома.'],
          ['Деепричастный оборот', 'Почти всегда, независимо от места', 'Проверив тетради, учитель ушёл домой.'],
          ['Обстоятельство', 'С предлогами «несмотря на», «вопреки»', 'Несмотря на усталость, альпинисты продолжили подъём.'],
          ['Приложение', 'В т.ч. «как» = причина', 'Мой брат, врач по профессии, помог соседям.'],
          ['Уточняющий член', 'Конкретизирует место/время', 'Внизу, у самой реки, рос камыш.']
        ]
      ),
      h3('Деепричастие — почти всегда'),
      p('Деепричастный оборот и одиночное деепричастие обособляются практически без исключений, где бы они ни стояли:'),
      bq('Проверив тетради, учитель ушёл домой.'),
      h3('Приложение и уточнение'),
      p(
        'Приложения — в том числе со словом ',
        i('«как»'),
        ' в значении причины — обособляются запятыми, как и уточняющие члены, конкретизирующие место или время:'
      ),
      bq('Мой брат, врач по профессии, помог соседям.', 'Как настоящий друг, ты всегда поддержишь.', 'Внизу, у самой реки, рос камыш.')
    ),
    cheatSheetTitle: 'Запятая при обособленных членах',
    cheatSheetSummary: 'Обособляем запятыми: определение после слова (или перед — с доп. значением), деепричастный оборот, обстоятельства с несмотря на/вопреки, приложения и уточнения.',
    cheatSheetRows: [
      ['Определение после слова', 'Дом, стоявший на холме, был виден издалека.'],
      ['Определение перед словом (причина/уступка)', 'Уставший, он всё же дошёл до дома.'],
      ['Деепричастный оборот', 'Проверив тетради, учитель ушёл домой.'],
      ['«Несмотря на» / «вопреки»', 'Несмотря на усталость, альпинисты продолжили подъём.'],
      ['Приложение (в т.ч. «как»=причина)', 'Мой брат, врач по профессии, помог соседям.'],
      ['Уточняющий член (место/время)', 'Внизу, у самой реки, рос камыш.']
    ],
    coverPrompt: 'Minimalist editorial photo of a comma-shaped paper cutout resting on lined notebook paper, warm daylight, soft shadows, no readable text',
    shortTestTitle: 'Обособленные члены: короткая проверка',
    largeTestTitle: 'Обособленные члены: большой тест',
    fillTextRebuild: {
      short: [
        ['Уставший', {gap: ','}, ' он всё же дошёл до дома.'],
        ['Дом', {gap: ','}, ' стоявший на холме', {gap: ','}, ' был виден издалека.'],
        ['Проверив тетради', {gap: ','}, ' учитель ушёл домой.'],
        ['Мы', {gap: ','}, ' несмотря на дождь', {gap: ','}, ' пошли гулять.'],
        ['Внизу', {gap: ','}, ' у самой реки', {gap: ','}, ' рос камыш.'],
        ['Как опытный охотник', {gap: ','}, ' он быстро нашёл след.']
      ],
      large: [
        [
          ['Он посмотрел на меня', {gap: ','}, ' прищурив глаза.'],
          ['Утомлённые долгой дорогой', {gap: ','}, ' туристы остановились на привал.'],
          ['Книга', {gap: ','}, ' забытая кем-то на скамейке', {gap: ','}, ' промокла под дождём.'],
          ['Несмотря на усталость', {gap: ','}, ' альпинисты продолжили подъём.'],
          ['Вопреки прогнозу', {gap: ','}, ' погода была солнечной.'],
          ['Мой брат', {gap: ','}, ' врач по профессии', {gap: ','}, ' помог соседям.']
        ],
        [
          ['Ты', {gap: ','}, ' как настоящий друг', {gap: ','}, ' всегда поддержишь.'],
          ['Согревшись у костра', {gap: ','}, ' путники повеселели.'],
          ['Мы решили отдохнуть', {gap: ','}, ' читая книги и слушая музыку.'],
          ['Справа', {gap: ','}, ' у самого леса', {gap: ','}, ' стояла старая мельница.'],
          ['Вечером', {gap: ','}, ' часов в шесть', {gap: ','}, ' мы встретимся у входа.'],
          ['Испуганный внезапным шумом', {gap: ','}, ' заяц бросился в кусты.']
        ]
      ]
    },
    varietyForLargeTest: () =>
      matchPairsBlock([
        {left: 'Деепричастный оборот', right: 'Проверив тетради, учитель ушёл домой.'},
        {left: 'Определение после слова', right: 'Дом, стоявший на холме, был виден издалека.'},
        {left: 'Обстоятельство с «несмотря на»', right: 'Несмотря на усталость, альпинисты продолжили подъём.'},
        {left: 'Приложение', right: 'Мой брат, врач по профессии, помог соседям.'}
      ])
  },

  // ───────────── complex-sentence-punctuation ─────────────
  {
    slug: 'complex-sentence-punctuation',
    postTitle: 'Знаки препинания в сложном предложении: единый алгоритм',
    richText: richDoc(
      h2('Сначала тип, потом знак'),
      p(
        'Чтобы верно расставить знаки в сложном предложении, нужно сначала понять, к какому из ',
        b('трёх типов'),
        ' оно относится — сложносочинённое, сложноподчинённое или бессоюзное, — потому что у каждого типа своя пунктуационная логика. Алгоритм ниже самодостаточен и работает для любого сложного предложения.'
      ),
      ol([
        'Найди все грамматические основы — если она одна, предложение простое.',
        'Основ несколько — предложение сложное. Ищи союз или союзное слово между частями.',
        'Нет союза (только интонация) — бессоюзное предложение (БСП): смотри на смысловые отношения между частями.',
        'Союз сочинительный (и, а, но, да, зато) — сложносочинённое предложение (ССП), запятая перед союзом.',
        'Союз/союзное слово подчинительный (что, чтобы, если, который, потому что) — сложноподчинённое предложение (СПП), запятая на границе главной и придаточной части.'
      ]),
      h3('БСП: знак по смыслу'),
      p(
        'В бессоюзном сложном предложении части связаны только интонацией — знак выбирается по смысловым отношениям между ними, той же подстановкой, что и в темах «Двоеточие»/«Тире».'
      ),
      bq('Я не пошёл гулять: начался дождь.', 'Ударил мороз — река стала.'),
      p(
        'Важное исключение в ССП: если у частей есть общий второстепенный член или общее вводное слово, перед одиночным союзом «и» запятая не ставится:'
      ),
      bq('Вечером стемнело и подул холодный ветер.'),
      tableNode(
        ['Отношение в БСП', 'Проверочное слово', 'Знак'],
        [
          ['Причина', '= потому что', 'Двоеточие'],
          ['Пояснение', '= а именно', 'Двоеточие'],
          ['Следствие / резкая смена событий', '= поэтому / и вдруг', 'Тире'],
          ['Противопоставление', '= а', 'Тире'],
          ['Части сильно распространены, слабо связаны по смыслу', '—', 'Точка с запятой']
        ]
      )
    ),
    cheatSheetTitle: 'Знаки препинания в сложном предложении (сводно)',
    cheatSheetSummary: 'Сначала определи тип сложного предложения (ССП/СПП/БСП), затем применяй его собственную пунктуационную логику.',
    cheatSheetRows: [
      ['БСП, причина/пояснение → двоеточие', 'Я не пошёл гулять: начался дождь.'],
      ['БСП, следствие/противопоставление → тире', 'Ударил мороз — река стала.'],
      ['ССП → запятая перед союзом', 'Мама позвала меня, и я побежал домой.'],
      ['СПП → запятая на границе частей', 'Мы знали, что экзамен будет трудным.'],
      ['Придаточное внутри главного', 'Книга, которую я прочитал, оказалась интересной.']
    ],
    coverPrompt: 'Minimalist editorial illustration of interconnected geometric branches forming a decision tree, muted ink-on-paper palette, no readable text',
    shortTestTitle: 'Знаки препинания в сложном предложении: короткая проверка',
    largeTestTitle: 'Знаки препинания в сложном предложении: большой тест',
    varietyForLargeTest: () =>
      matchPairsBlock([
        {left: 'ССП (сочинительный союз)', right: 'Ветер стих, но волны ещё бились.'},
        {left: 'СПП (подчинительный союз)', right: 'Мы знали, что экзамен будет трудным.'},
        {left: 'БСП, причина (двоеточие)', right: 'Я не пошёл гулять: начался дождь.'},
        {left: 'БСП, следствие (тире)', right: 'Ударил мороз — река стала.'}
      ])
  },

  // ───────────── introductory-punctuation ─────────────
  {
    slug: 'introductory-punctuation',
    postTitle: 'Вводные слова и обращения: расставляем запятые верно',
    richText: richDoc(
      h2('Вводное слово или полноценный член предложения?'),
      p(
        'Вводные слова (кажется, конечно, к счастью, во-первых, например…) выражают отношение говорящего к сказанному и ',
        i('не являются членами предложения'),
        ' — они всегда выделяются запятыми. Обращения называют того, к кому обращаются, и тоже выделяются запятыми независимо от места в предложении.'
      ),
      h3('Ловушка — омонимия'),
      p('Главная трудность в том, что некоторые слова совпадают по форме с вводными, но в другом контексте являются полноценным членом предложения или союзом.'),
      tableNode(
        ['Было (не вводное, без запятой)', 'Стало (вводное, с запятой)'],
        [
          ['Мне это давно кажется подозрительным.', 'Кажется, дождь скоро закончится.'],
          ['Однако дождь не переставал. (союз = но)', 'Дождь, однако, не переставал. (= впрочем)'],
          ['Он пришёл домой наконец. (= напоследок)', 'Наконец мы можем отдохнуть. (= и вот)']
        ]
      ),
      h3('Обращение — в любом месте предложения'),
      p('В начале, середине или конце — обращение всегда выделяется запятыми:'),
      bq('Ребята, приготовьтесь к старту.', 'Слушай, друг, я всё понял.', 'Береги себя, мама.'),
      ul([
        'Уверенность/неуверенность: конечно, разумеется, возможно, вероятно — всегда в запятых.',
        'Порядок мыслей: во-первых, наконец, например, итак — всегда в запятых.',
        'Омонимы-ловушки: кажется, однако, наконец — проверяй по контексту, а не по слову.'
      ])
    ),
    cheatSheetTitle: 'Пунктуация при вводных словах и обращениях',
    cheatSheetSummary: 'Вводные слова и обращения выделяются запятыми; главная ловушка — омонимы (кажется/однако/наконец), которые без запятой являются членом предложения или союзом.',
    cheatSheetRows: [
      ['«кажется» — вводное (предположение)', 'Кажется, дождь скоро закончится.'],
      ['«кажется» — сказуемое (без запятой)', 'Мне это давно кажется подозрительным.'],
      ['«однако» — вводное (=впрочем)', 'Дождь, однако, не переставал.'],
      ['«однако» — союз в начале (=но)', 'Однако дождь не переставал.'],
      ['«наконец» — вводное (=и вот)', 'Наконец мы можем отдохнуть.'],
      ['Обращение — в любом месте', 'Ребята, приготовьтесь к старту.']
    ],
    coverPrompt: 'Warm editorial photo of a hand-written letter with a small doodle in the margin, soft daylight, cozy desk atmosphere, no readable text',
    shortTestTitle: 'Вводные слова и обращения: короткая проверка',
    largeTestTitle: 'Вводные слова и обращения: большой тест',
    varietyForLargeTest: () =>
      dialogueBlock('Расставьте реплики диалога в правильном порядке.', {a: 'Олег', b: 'Настя'}, [
        {speaker: 'a', text: 'Настя, кажется, начинается дождь.'},
        {speaker: 'b', text: 'Да, действительно. Друзья, давайте зайдём в кафе!'},
        {speaker: 'a', text: 'Отличная идея. Кстати, ты не забыла зонт?'},
        {speaker: 'b', text: 'К счастью, взяла.'}
      ])
  }
]

// ───────────────────────── main ─────────────────────────

interface PostBlockLike {
  id: string
  type: string
  payload: Record<string, unknown>
}

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: TEACHER_EMAIL}})

  let coversRefreshed = 0
  let coversSkipped = 0
  let coversFailed = 0
  let contentRefreshed = 0
  let contentSkipped = 0
  let testsRefreshed = 0
  let testsSkipped = 0

  for (const topic of TOPICS) {
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id, title: topic.postTitle}})
    if (!post) {
      console.log(`! пост для ${topic.slug} не найден ("${topic.postTitle}") — пропуск`)
      continue
    }

    console.log(`\n─── ${topic.slug} ───`)

    const content = post.content as {blocks: PostBlockLike[]} | null
    const blocks = content?.blocks ?? []
    const mediaIndex = blocks.findIndex((bl) => bl.type === 'MEDIA')
    const fileListIndex = blocks.findIndex((bl) => bl.type === 'FILE_LIST')
    const textIndex = blocks.findIndex((bl) => bl.type === 'TEXT')

    const currentCoverUrl = mediaIndex >= 0 ? (blocks[mediaIndex].payload?.url as string | undefined) : undefined
    const currentPdfUrl =
      fileListIndex >= 0 ? ((blocks[fileListIndex].payload?.files as {url?: string}[] | undefined)?.[0]?.url as string | undefined) : undefined

    const coverDone = !!currentCoverUrl && OLD_COVER_FOLDER_MARKERS.some((m) => currentCoverUrl.includes(m))
    const contentDone = !!currentPdfUrl && currentPdfUrl.includes(CHEATSHEET_FOLDER)

    let newCoverUrl = currentCoverUrl
    if (!coverDone) {
      try {
        const png = await generateCoverImagePng(topic.coverPrompt)
        const jpeg = await compressCover(png)
        newCoverUrl = await uploadBuffer(jpeg, COVER_FOLDER, 'jpg', teacher.id, 'image/jpeg')
        console.log(`  + обложка (v3, ${jpeg.length}B): ${newCoverUrl}`)
        coversRefreshed++
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`  ! обложка ${topic.slug}: ${msg} — оставляю текущую (${currentCoverUrl ?? 'нет'})`)
        coversFailed++
      }
    } else {
      console.log(`  = обложка уже v3 — пропуск`)
      coversSkipped++
    }

    let newBlocks = blocks
    if (!contentDone) {
      const cheatSheetBuffer = await buildCheatSheetPdfV2(`${topic.cheatSheetTitle} — шпаргалка`, topic.cheatSheetSummary, topic.cheatSheetRows)
      const cheatSheetUrl = await uploadBuffer(cheatSheetBuffer, CHEATSHEET_FOLDER, 'pdf', teacher.id, 'application/pdf')
      console.log(`  + шпаргалка PDF (v2, ${cheatSheetBuffer.length}B): ${cheatSheetUrl}`)

      const newTextBlock = {id: textIndex >= 0 ? blocks[textIndex].id : uid(), type: 'TEXT', payload: {content: topic.richText}}
      const newFileListBlock = {
        id: fileListIndex >= 0 ? blocks[fileListIndex].id : uid(),
        type: 'FILE_LIST',
        payload: {files: [{name: `${topic.cheatSheetTitle} — шпаргалка.pdf`, size: cheatSheetBuffer.length, mimeType: 'application/pdf', url: cheatSheetUrl}]}
      }

      newBlocks = blocks.map((bl, idx) => {
        if (idx === textIndex) return newTextBlock
        if (idx === fileListIndex) return newFileListBlock
        return bl
      })
      if (textIndex < 0) newBlocks = [newTextBlock, ...newBlocks]
      if (fileListIndex < 0) newBlocks = [...newBlocks, newFileListBlock]
      contentRefreshed++
    } else {
      console.log(`  = текст+PDF уже v2 — пропуск`)
      contentSkipped++
    }

    // cover url can change even when content (text/pdf) is already done, and vice versa
    if (mediaIndex >= 0 && newCoverUrl && newCoverUrl !== currentCoverUrl) {
      newBlocks = newBlocks.map((bl, idx) => (idx === mediaIndex ? {...bl, payload: {...bl.payload, url: newCoverUrl}} : bl))
    }

    if (newBlocks !== blocks || (newCoverUrl && newCoverUrl !== currentCoverUrl)) {
      const mediaUrls = newBlocks.filter((bl) => bl.type === 'MEDIA' && typeof bl.payload?.url === 'string').map((bl) => bl.payload.url as string)
      await prisma.post.update({where: {id: post.id}, data: {content: {blocks: newBlocks} as object, mediaUrls}})
      console.log(`  + пост обновлён: ${post.id}`)
    }

    // ── tests ──
    async function refreshTest(title: string, buildBlocks: () => unknown[]) {
      const test = await prisma.test.findFirst({where: {teacherId: teacher.id, title, testCategories: {some: {categoryId: category.id}}}})
      if (!test) {
        console.log(`  ! тест "${title}" не найден — пропуск`)
        return
      }
      const existingContent = test.content as {richVersion?: string; description?: string} | null
      if (existingContent?.richVersion === TEST_RICH_VERSION) {
        console.log(`  = тест "${title}" уже обновлён — пропуск`)
        testsSkipped++
        return
      }
      const blocks = buildBlocks()
      await prisma.test.update({
        where: {id: test.id},
        data: {content: {description: existingContent?.description ?? title, blocks, richVersion: TEST_RICH_VERSION} as object}
      })
      console.log(`  + тест "${title}" обновлён (${blocks.length} блоков)`)
      testsRefreshed++
    }

    if (topic.fillTextRebuild) {
      await refreshTest(topic.shortTestTitle, () => [fillTextBlock(topic.fillTextRebuild!.short)])
      await refreshTest(topic.largeTestTitle, () => [
        ...topic.fillTextRebuild!.large.map((paras) => fillTextBlock(paras)),
        topic.varietyForLargeTest()
      ])
    } else {
      // non-FILL_TEXT topics: don't touch the short test (no bug there, no variety
      // mandated for it), only append one variety block to the large test — fetched
      // from the DB, not re-typed, so existing HIGHLIGHT_TEXT/CHOOSE_OPTION/SEQUENCE
      // blocks are preserved byte-for-byte.
      const largeTest = await prisma.test.findFirst({
        where: {teacherId: teacher.id, title: topic.largeTestTitle, testCategories: {some: {categoryId: category.id}}}
      })
      if (!largeTest) {
        console.log(`  ! тест "${topic.largeTestTitle}" не найден — пропуск`)
      } else {
        const existingContent = largeTest.content as {richVersion?: string; description?: string; blocks?: unknown[]} | null
        if (existingContent?.richVersion === TEST_RICH_VERSION) {
          console.log(`  = тест "${topic.largeTestTitle}" уже обновлён — пропуск`)
          testsSkipped++
        } else {
          const blocks = [...(existingContent?.blocks ?? []), topic.varietyForLargeTest()]
          await prisma.test.update({
            where: {id: largeTest.id},
            data: {content: {description: existingContent?.description ?? topic.largeTestTitle, blocks, richVersion: TEST_RICH_VERSION} as object}
          })
          console.log(`  + тест "${topic.largeTestTitle}" обновлён (+1 блок вариативности, ${blocks.length} блоков всего)`)
          testsRefreshed++
        }
      }
    }
  }

  // ── block summary PDF (redesigned, v2 folder) ──
  const summaryBuffer = await buildSummaryPdfV2(
    'Пунктуация — оглавление блока',
    TOPICS.map((t) => ({name: t.cheatSheetTitle, line: t.cheatSheetSummary}))
  )
  const summaryUrl = await uploadBuffer(summaryBuffer, CHEATSHEET_FOLDER, 'pdf', teacher.id, 'application/pdf')
  console.log(`\n+ сводный PDF блока «Пунктуация» (v2): ${summaryUrl}`)

  console.log('\n─── ИТОГ ───')
  console.log(
    JSON.stringify(
      {coversRefreshed, coversSkipped, coversFailed, contentRefreshed, contentSkipped, testsRefreshed, testsSkipped, summaryUrl},
      null,
      2
    )
  )
  if (coversFailed > 0) {
    console.warn(
      `\n⚠ ${coversFailed} обложка(и) не сгенерированы (см. ошибки выше) — текст/PDF/тесты для этих тем всё равно обновлены, обложки остались старыми. Повторный запуск после решения проблемы (например, пополнения баланса BYCOM_API_KEY) доделает только их.`
    )
  }
}

if (process.argv.includes('--selfcheck')) {
  selfCheck()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
} else {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
