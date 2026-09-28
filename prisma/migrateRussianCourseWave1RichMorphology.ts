/**
 * Quality pass on the 10 «Морфология» topics shipped by prisma/seedRussianCourse02Morphology.ts
 * (see .autopilot/russian-course/interfaces.md §8 «Тикет 02»). Addresses user feedback after
 * reviewing wave 1 live:
 *  1. TEXT posts were flat/robotic — rewritten with real TipTap formatting (bold/italic/
 *     blockquote/headings/lists, tables where the topic has an actual grid).
 *  2. Cover images were 1-1.5MB PNGs — see D-IMG deviation below, this could not be fixed via
 *     API params (checked, see comment on generateCoverImage) and BYCOM_API_KEY has 0 balance
 *     right now, so image regeneration is best-effort/blocked, not silently skipped.
 *  3. FILL_TEXT blocks were one-gap-per-block ("она чита_", "они чита_", ...) — rebuilt into
 *     real multi-gap exercises: one FILL_TEXT block = several natural sentences, each with an
 *     `inputGap` inline node. Applies to the 3 topics that use FILL_TEXT (noun/verb/numeral);
 *     verb-morphology was the exact garbled example the user pasted — fixed specifically.
 *  4. More block-type variety — every topic's tests get at least one DIALOGUE or MATCH_PAIRS
 *     block added on top of whatever was already there (existing well-formed CHOOSE_OPTION/
 *     MATCH_PAIRS/HIGHLIGHT_TEXT content is reused, not thrown away — only FILL_TEXT blocks are
 *     rebuilt from scratch).
 *  5. Cheat-sheet PDFs were a plain bullet dump — redesigned: colored header band, sectioned
 *     bullets, a real hand-drawn table (page.drawRectangle/drawLine/drawText — pdf-lib has no
 *     table primitive) for topics with an actual grid.
 *
 * No `src/` import at runtime (production image doesn't ship `src/` — bit prisma/migrate*.ts
 * scripts twice already, see migrateRussianCourseWave1.ts / migrateRussianCourseWave1CoverRefresh.ts).
 * Block `type` fields are plain string literals, not enum imports.
 *
 * Idempotency (two independent markers, so a balance-blocked image retry doesn't redo free work):
 *  - "rich" marker: post's FILE_LIST url contains RICH_CHEATSHEET_FOLDER → TEXT/PDF/tests for
 *    that topic are already done, skip all of it (no API cost involved, but avoids orphaning a
 *    fresh PDF/S3 upload and duplicate prisma writes on every re-run).
 *  - "image" marker: post's MEDIA url contains RICH_COVER_FOLDER → cover already regenerated,
 *    skip the paid call. If image generation fails (e.g. insufficient balance), the topic is
 *    still fully updated on the text/PDF/tests side; only the MEDIA block is left pointing at
 *    the old (v1/v2) cover, to be retried on a future run once BYCOM_API_KEY has balance.
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1RichMorphology.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {PDFDocument, PDFFont, PDFPage, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import sharp from 'sharp'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
// D-IMG: checked GET /v1/models for both flux-2-klein-4b and z-image-turbo (2026-09-28) — neither
// exposes a size or response_format/quality parameter (only `n`, and sell_pricing lists exactly
// one size tier: "1024x1024_standard"). The "request a smaller size/JPEG" route from the brief is
// a dead end at the API level, not something this script is doing wrong. Real compression now
// happens post-generation via `sharp` (added as a real dependency, see compressCover below) —
// resize + re-encode as JPEG, since there's no smaller size tier to request at the API level.
// Using the cheaper of the two models (z-image-turbo, 0.03 BYN). Separately, BYCOM_API_KEY
// currently has a 0.0000 BYN balance (verified: POST .../generations → 402 "insufficient balance"
// on 2026-09-28) — every image call below will fail until it's topped up; handled per-topic with
// try/catch so it doesn't block the free (text/tests/PDF) work.
const BYCOM_API_KEY = process.env.BYCOM_API_KEY
const IMAGE_MODEL = 'z-image-turbo'
const RICH_COVER_FOLDER = 'russian-course-images-v3'
const RICH_CHEATSHEET_FOLDER = 'russian-course-cheatsheets-v2'

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY!}
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

// ───────────────────────── id helper ─────────────────────────
let _uidCounter = 0
function uid() {
  return `rc02rich-${Date.now()}-${++_uidCounter}`
}

// ───────────────────────── TipTap doc builders (TEXT block) ─────────────────────────
// Verified against src/features/BlockEditors/InfoTextEditor/InfoTextEditor.tsx: StarterKit
// (paragraph/heading/bold/italic/blockquote/lists) + @tiptap/extension-table + table-row/
// table-header/table-cell, standard nesting (table > tableRow > tableHeader|tableCell > paragraph).
type TNode = Record<string, unknown>
function tx(text: string, marks?: ('bold' | 'italic')[]): TNode {
  return marks?.length ? {type: 'text', text, marks: marks.map((m) => ({type: m}))} : {type: 'text', text}
}
// run: plain string = plain text, [text, marks] = marked text
type Run = string | [string, ('bold' | 'italic')[]]
function p(...runs: Run[]): TNode {
  return {type: 'paragraph', content: runs.filter((r) => (Array.isArray(r) ? r[0] : r)).map((r) => (Array.isArray(r) ? tx(r[0], r[1]) : tx(r)))}
}
function h2(text: string): TNode {
  return {type: 'heading', attrs: {level: 2}, content: [tx(text)]}
}
function h3(text: string): TNode {
  return {type: 'heading', attrs: {level: 3}, content: [tx(text)]}
}
function bq(...paragraphs: TNode[]): TNode {
  return {type: 'blockquote', content: paragraphs}
}
function ul(items: Run[][]): TNode {
  return {type: 'bulletList', content: items.map((runs) => ({type: 'listItem', content: [p(...runs)]}))}
}
function table(headers: string[], rows: string[][]): TNode {
  return {
    type: 'table',
    content: [
      {type: 'tableRow', content: headers.map((hText) => ({type: 'tableHeader', content: [p(hText)]}))},
      ...rows.map((row) => ({type: 'tableRow', content: row.map((cell) => ({type: 'tableCell', content: [p(cell)]}))}))
    ]
  }
}
function doc(...nodes: TNode[]): TNode {
  return {type: 'doc', content: nodes}
}

// ───────────────────────── post/test block builders ─────────────────────────
function textBlock(content: TNode) {
  return {id: uid(), type: 'TEXT', payload: {content}}
}
function mediaBlock(url: string, caption: string) {
  return {id: uid(), type: 'MEDIA', payload: {kind: 'image', url, caption}}
}
function testLinkBlock(tests: {id: string; title: string}[]) {
  return {id: uid(), type: 'TEST_LINK', payload: {tests}}
}
function fileListBlock(files: {name: string; size: number; mimeType: string; url: string}[]) {
  return {id: uid(), type: 'FILE_LIST', payload: {files}}
}
function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]): string[] {
  return blocks.filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string').map((b) => b.payload.url as string)
}

// FILL_TEXT: one block = several natural sentences (paragraphs), each with inline `inputGap`
// nodes. gapId MUST be set explicitly — InputGapNode.tsx defaults it via crypto.randomUUID() at
// *editor parse time* when missing, which would desync from scoreBlock.tsx's extractGaps() reading
// the same-looking-but-differently-parsed raw JSON from the DB (confirmed by reading both files).
type FillPart = string | {gap: string}
function fillTextBlock(sentences: FillPart[][]) {
  const paragraphs = sentences.map((parts) => {
    const content: TNode[] = []
    for (const part of parts) {
      if (typeof part === 'string') {
        if (part) content.push(tx(part))
      } else {
        content.push({type: 'inputGap', attrs: {gapId: uid(), answer: part.gap}})
      }
    }
    return {type: 'paragraph', content}
  })
  return {id: uid(), type: 'FILL_TEXT', payload: {content: {type: 'doc', content: paragraphs}}}
}
function chooseBlock(question: string, options: string[], correctIndex: number) {
  const opts = options.map((text) => ({id: uid(), text}))
  return {id: uid(), type: 'CHOOSE_OPTION', payload: {question, options: opts, correctId: opts[correctIndex].id}}
}
function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {id: uid(), type: 'MATCH_PAIRS', payload: {pairs: pairs.map((pr) => ({id: uid(), left: pr.left, right: pr.right}))}}
}
function highlightTextBlock(instruction: string, tokens: {text: string; correct: boolean}[]) {
  return {id: uid(), type: 'HIGHLIGHT_TEXT', payload: {instruction, tokens: tokens.map((t, id) => ({id, text: t.text, isCorrect: t.correct}))}}
}
// DialoguePayload: {instruction, speakers:{a,b}, lines:{id,speaker,text}[]} — TaskPayload.type.ts,
// scored by exact line-id order (scoreBlock.tsx DIALOGUE case).
function dialogueBlock(instruction: string, speakers: {a: string; b: string}, lines: {speaker: 'a' | 'b'; text: string}[]) {
  return {id: uid(), type: 'DIALOGUE', payload: {instruction, speakers, lines: lines.map((l) => ({id: uid(), speaker: l.speaker, text: l.text}))}}
}

type BlockSpec =
  | {kind: 'choose'; question: string; options: string[]; correct: number}
  | {kind: 'fill'; sentences: FillPart[][]}
  | {kind: 'match'; pairs: {left: string; right: string}[]}
  | {kind: 'highlight'; instruction: string; tokens: {text: string; correct: boolean}[]}
  | {kind: 'dialogue'; instruction: string; speakers: {a: string; b: string}; lines: {speaker: 'a' | 'b'; text: string}[]}

function buildTestBlock(spec: BlockSpec) {
  switch (spec.kind) {
    case 'choose':
      return chooseBlock(spec.question, spec.options, spec.correct)
    case 'fill':
      return fillTextBlock(spec.sentences)
    case 'match':
      return matchPairsBlock(spec.pairs)
    case 'highlight':
      return highlightTextBlock(spec.instruction, spec.tokens)
    case 'dialogue':
      return dialogueBlock(spec.instruction, spec.speakers, spec.lines)
  }
}

// ───────────────────────── image generation (api.bycom.by) ─────────────────────────
async function generateCoverImage(prompt: string): Promise<Buffer> {
  if (!BYCOM_API_KEY) throw new Error('BYCOM_API_KEY is not set in .env')
  const res = await fetch('https://api.bycom.by/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${BYCOM_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: IMAGE_MODEL, prompt, n: 1, size: '1024x1024'})
  })
  if (!res.ok) throw new Error(`bycom.by ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as {data: {b64_json: string}[]}
  const b64 = json.data[0]?.b64_json
  if (!b64) throw new Error(`bycom.by response has no b64_json: ${JSON.stringify(json)}`)
  return Buffer.from(b64, 'base64')
}

// Source is a square 1024x1024 PNG (see `size` above) — resize down to 768x768 and re-encode
// as JPEG q78/mozjpeg (photographic/gradient poster art, PNG was the wrong format to begin with).
async function compressCover(pngBuffer: Buffer): Promise<Buffer> {
  return sharp(pngBuffer).resize(768, 768, {fit: 'inside'}).jpeg({quality: 78, mozjpeg: true}).toBuffer()
}

// ───────────────────────── PDF redesign (pdf-lib + fontkit, manual table grid) ─────────────────────────
const A4: [number, number] = [595.28, 841.89]
const MARGIN_X = 50
const CONTENT_WIDTH = A4[0] - MARGIN_X * 2

// One warm burgundy accent, used consistently: band fill, section rule, table header tint.
const ACCENT_MAIN = rgb(0.42, 0.11, 0.18)
const ACCENT_LIGHT = rgb(0.98, 0.94, 0.92)
const ACCENT_TINT = rgb(0.94, 0.86, 0.85)
const ACCENT_DARK = rgb(0.32, 0.09, 0.14)
const INK = rgb(0.12, 0.12, 0.12)
const HAIRLINE = rgb(0.72, 0.72, 0.72)

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

interface CheatSheetSection {
  heading: string
  bullets: string[]
}
interface CheatSheetTable {
  headers: string[]
  rows: string[][]
  colWidths: number[] // must sum to CONTENT_WIDTH
}

function drawTable(page: PDFPage, x: number, yTop: number, t: CheatSheetTable, fonts: {regular: PDFFont; bold: PDFFont}): number {
  const lineHeight = 12.5
  const padX = 6
  const padY = 6
  const fontSize = 9
  const allRows = [
    {cells: t.headers, isHeader: true},
    ...t.rows.map((cells) => ({cells, isHeader: false}))
  ]
  let y = yTop
  const rowTops: number[] = [y]
  for (const row of allRows) {
    const font = row.isHeader ? fonts.bold : fonts.regular
    const linesPerCell = row.cells.map((c, i) => wrapText(c, font, fontSize, t.colWidths[i] - padX * 2))
    const maxLines = Math.max(1, ...linesPerCell.map((l) => l.length))
    const rowHeight = maxLines * lineHeight + padY * 2

    if (row.isHeader) page.drawRectangle({x, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: ACCENT_TINT})

    let cx = x
    for (let i = 0; i < row.cells.length; i++) {
      let ty = y - padY - fontSize
      for (const line of linesPerCell[i]) {
        page.drawText(line, {x: cx + padX, y: ty, size: fontSize, font, color: row.isHeader ? ACCENT_DARK : INK})
        ty -= lineHeight
      }
      cx += t.colWidths[i]
    }
    y -= rowHeight
    rowTops.push(y)
  }
  // grid lines
  for (const ry of rowTops) page.drawLine({start: {x, y: ry}, end: {x: x + CONTENT_WIDTH, y: ry}, thickness: 0.75, color: HAIRLINE})
  let cx = x
  for (let i = 0; i <= t.colWidths.length; i++) {
    page.drawLine({start: {x: cx, y: yTop}, end: {x: cx, y}, thickness: 0.75, color: HAIRLINE})
    if (i < t.colWidths.length) cx += t.colWidths[i]
  }
  return y
}

async function buildCheatSheetPdfV2(topicTitle: string, sections: CheatSheetSection[], tbl?: CheatSheetTable): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)

  // header band
  const bandHeight = 64
  page.drawRectangle({x: 0, y: A4[1] - bandHeight, width: A4[0], height: bandHeight, color: ACCENT_MAIN})
  page.drawText('ШПАРГАЛКА · РУССКИЙ ЯЗЫК', {x: MARGIN_X, y: A4[1] - 24, size: 9, font: fonts.bold, color: ACCENT_LIGHT})
  page.drawText(topicTitle, {x: MARGIN_X, y: A4[1] - 46, size: 18, font: fonts.bold, color: ACCENT_LIGHT})

  let y = A4[1] - bandHeight - 26

  for (const section of sections) {
    page.drawRectangle({x: MARGIN_X, y: y - 11, width: 3, height: 13, color: ACCENT_MAIN})
    page.drawText(section.heading, {x: MARGIN_X + 10, y: y - 9, size: 12.5, font: fonts.bold, color: ACCENT_DARK})
    y -= 24
    for (const line of section.bullets) {
      for (const wrapped of wrapText(`•  ${line}`, fonts.regular, 10.5, CONTENT_WIDTH - 8)) {
        page.drawText(wrapped, {x: MARGIN_X + 8, y, size: 10.5, font: fonts.regular, color: INK})
        y -= 15.5
      }
    }
    y -= 10
  }

  if (tbl) {
    y -= 4
    y = drawTable(page, MARGIN_X, y, tbl, fonts)
  }

  return Buffer.from(await pdfDoc.save())
}

// ───────────────────────── categories (all already exist from ticket 02) ─────────────────────────
const SLUGS = [
  'parts-of-speech',
  'participles-gerunds',
  'noun-morphology',
  'adjective-morphology',
  'verb-morphology',
  'pronoun-morphology',
  'numeral-morphology',
  'adverb-morphology',
  'function-words',
  'interjections'
] as const

// Same "bold advertising poster" prompts already vetted for these topics in
// migrateRussianCourseWave1CoverRefresh.ts (§102 of interfaces.md) — reused verbatim for visual
// continuity, only the destination folder/model change.
const COVER_PROMPTS: Record<(typeof SLUGS)[number], string> = {
  'parts-of-speech':
    'Bold advertising poster showing a colorful constellation map connecting ten glowing category icons, representing the full system of Russian parts of speech, vibrant gradient background, modern infographic poster style, no readable text',
  'participles-gerunds':
    'Dynamic advertising poster of a figure frozen mid-motion with a glowing trailing streak, symbolizing participles and adverbial participles describing action and state at once, bold saturated colors, modern poster design, no readable text',
  'noun-morphology':
    'Bold advertising poster of a solid glowing geometric object rotating through six colored facets, symbolizing a Russian noun changing through its six grammatical cases, vivid saturated colors, modern poster design, no readable text',
  'adjective-morphology':
    'Vibrant advertising poster of a plain object being painted with bold colorful brush strokes, symbolizing adjectives adding qualities to a word, dynamic modern poster composition, saturated palette, no readable text',
  'verb-morphology':
    'Energetic advertising poster of a glowing arrow launching forward with a motion trail through past, present and future zones, symbolizing the Russian verb and its tenses, bold vivid colors, modern dynamic poster design, no readable text',
  'pronoun-morphology':
    'Playful advertising poster of a glowing silhouette that mirrors and replaces other colorful silhouettes around it, symbolizing pronouns standing in for nouns, bold contrasting colors, modern poster design, no readable text',
  'numeral-morphology':
    'Bold advertising poster of oversized glowing numeral shapes stacked like building blocks, symbolizing Russian numerals and their declension, vivid saturated color palette, modern graphic poster design, no readable text',
  'adverb-morphology':
    'Dynamic advertising poster of a glowing speedometer-like dial surrounded by motion streaks, symbolizing adverbs describing how an action happens, bold vibrant colors, modern poster composition, no readable text',
  'function-words':
    'Bold advertising poster of three small glowing connector shapes linking larger colorful blocks together like bridges, symbolizing prepositions, conjunctions and particles, vivid saturated colors, modern poster design, no readable text',
  interjections:
    'Energetic advertising poster of a bright comic-style burst and sound-wave rings radiating outward, symbolizing interjections and sound-imitating words, bold saturated colors, playful modern poster design, no readable text'
}

// ───────────────────────── per-topic content ─────────────────────────
interface Topic {
  slug: (typeof SLUGS)[number]
  postTitle: string // must match seedRussianCourse02Morphology.ts exactly — that's the lookup key
  richContent: TNode
  cheatTitle: string
  cheatSections: CheatSheetSection[]
  cheatTable?: CheatSheetTable
  shortTestTitle: string
  shortTestBlocks: BlockSpec[]
  largeTestTitle: string
  largeTestBlocks: BlockSpec[]
}

const TOPICS: Topic[] = [
  // ── 1. parts-of-speech ──────────────────────────────────────────────────────────────────
  {
    slug: 'parts-of-speech',
    postTitle: 'Части речи русского языка: полная система',
    richContent: doc(
      p(
        ['Возьмите любое слово из этого предложения — ', []],
        ['каждое', ['bold']],
        [' из них принадлежит какой-то части речи. Всего в русском языке ', []],
        ['десять самостоятельных', ['bold']],
        [' и ', []],
        ['три служебные', ['bold']],
        [' части речи, а ещё одна — особняком. Разобраться в этой системе — значит перестать гадать и начать проверять себя вопросом.', []]
      ),
      h3('Самостоятельные части речи'),
      p(
        ['Самостоятельные (их ещё называют знаменательными) части речи называют предмет, признак, действие или количество и всегда являются ', []],
        ['членами предложения', ['bold']],
        ['. К ним относятся: имя существительное (кто? что?), имя прилагательное (какой? чей?), имя числительное (сколько? который?), местоимение (указывает на предмет, не называя его), глагол (что делать? что сделать?) вместе с особыми формами — причастием и деепричастием — и наречие (как? когда? где?).', []]
      ),
      h3('Служебные части речи'),
      p(
        ['Предлог, союз и частица ', []],
        ['не являются членами предложения', ['italic']],
        [' — они связывают слова и части предложения или добавляют смысловой оттенок. Предлог соединяет слова в словосочетании (', []],
        ['в школу, из-за дождя', ['italic']],
        ['), союз связывает однородные члены и части сложного предложения (', []],
        ['и, но, потому что', ['italic']],
        ['), частица вносит смысловой или эмоциональный акцент (', []],
        ['не, ли, же', ['italic']],
        [').', []]
      ),
      bq(p(['Проверочный вопрос один: ', []], ['«Это слово называет что-то — или только связывает/добавляет оттенок?» ', ['bold']], ['Если называет — часть речи самостоятельная. Если связывает — служебная.', []])),
      h3('Особая группа'),
      p(
        ['Междометие (', []],
        ['ах, ой, увы', ['italic']],
        [') и звукоподражательные слова (', []],
        ['мяу, тик-так', ['italic']],
        [') не входят ни в одну из этих групп: они ничего не называют и ничего не связывают, а просто выражают эмоцию или имитируют звук.', []]
      ),
      table(
        ['Группа', 'Части речи', 'На что указывают'],
        [
          ['Самостоятельные', 'Существительное, прилагательное, числительное, местоимение, глагол (+ причастие, деепричастие), наречие', 'Называют предмет/признак/действие/количество, являются членами предложения'],
          ['Служебные', 'Предлог, союз, частица', 'Связывают слова и части предложения или вносят оттенок смысла; членами предложения не являются'],
          ['Особая группа', 'Междометие, звукоподражательные слова', 'Выражают эмоцию или имитируют звук; не называют и не связывают']
        ]
      )
    ),
    cheatTitle: 'Части речи: система',
    cheatSections: [
      {
        heading: 'Самостоятельные (члены предложения)',
        bullets: [
          'Существительное — кто? что?; прилагательное — какой? чей?; числительное — сколько? который?',
          'Местоимение указывает на предмет/признак/количество, не называя их: он, такой, столько.',
          'Глагол — что делать?/что сделать?; причастие — какой? что делающий?; деепричастие — что делая?/что сделав?',
          'Наречие — как? когда? где? куда? откуда? почему?; не изменяется.'
        ]
      },
      {
        heading: 'Служебные и особая группа',
        bullets: [
          'Предлог связывает слова (в, из-за); союз — части предложения (и, но, потому что); частица вносит оттенок (не, бы, же).',
          'Междометие и звукоподражательные слова: выражают эмоцию или имитируют звук (ах, мяу), не называют и не связывают.'
        ]
      }
    ],
    cheatTable: {
      headers: ['Группа', 'Части речи', 'На что указывают'],
      colWidths: [95, 195, 205],
      rows: [
        ['Самостоятельные', 'Сущ., прилаг., числит., местоим., глагол (+ прич., дееприч.), наречие', 'Называют предмет/признак/действие/количество'],
        ['Служебные', 'Предлог, союз, частица', 'Связывают слова/части предложения или вносят оттенок'],
        ['Особая группа', 'Междометие, звукоподражания', 'Выражают эмоцию или имитируют звук']
      ]
    },
    shortTestTitle: 'Части речи: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [{left: 'быстро', right: 'наречие'}, {left: 'бежал', right: 'глагол'}]},
      {kind: 'match', pairs: [{left: 'пять', right: 'числительное'}, {left: 'какой', right: 'местоимение'}]},
      {kind: 'match', pairs: [{left: 'счастье', right: 'существительное'}, {left: 'красивый', right: 'прилагательное'}]},
      {kind: 'match', pairs: [{left: 'в', right: 'предлог'}, {left: 'и', right: 'союз'}]},
      {kind: 'match', pairs: [{left: 'не', right: 'частица'}, {left: 'ах', right: 'междометие'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Учитель', b: 'Ученик'},
        lines: [
          {speaker: 'a', text: 'Назови самостоятельную часть речи, которая отвечает на вопрос «кто? что?»'},
          {speaker: 'b', text: 'Это существительное!'},
          {speaker: 'a', text: 'А ту, что связывает части сложного предложения?'},
          {speaker: 'b', text: 'Союз — например, «потому что».'}
        ]
      }
    ],
    largeTestTitle: 'Части речи: большой тест на все разряды',
    largeTestBlocks: [
      {kind: 'match', pairs: [{left: 'дерево', right: 'существительное'}, {left: 'зелёный', right: 'прилагательное'}]},
      {kind: 'match', pairs: [{left: 'трое', right: 'числительное'}, {left: 'кто-то', right: 'местоимение'}]},
      {kind: 'match', pairs: [{left: 'пишет', right: 'глагол'}, {left: 'написанный', right: 'причастие'}]},
      {kind: 'match', pairs: [{left: 'написав', right: 'деепричастие'}, {left: 'вчера', right: 'наречие'}]},
      {kind: 'match', pairs: [{left: 'на', right: 'предлог'}, {left: 'чтобы', right: 'союз'}]},
      {kind: 'match', pairs: [{left: 'бы', right: 'частица'}, {left: 'увы', right: 'междометие'}]},
      {kind: 'match', pairs: [{left: 'мяу', right: 'звукоподражательное слово'}, {left: 'седьмой', right: 'числительное'}]},
      {kind: 'match', pairs: [{left: 'умный', right: 'прилагательное'}, {left: 'мудрость', right: 'существительное'}]},
      {kind: 'match', pairs: [{left: 'он', right: 'местоимение'}, {left: 'громко', right: 'наречие'}]},
      {kind: 'match', pairs: [{left: 'построил', right: 'глагол'}, {left: 'построенный', right: 'причастие'}]},
      {kind: 'match', pairs: [{left: 'построив', right: 'деепричастие'}, {left: 'из-за', right: 'предлог'}]},
      {kind: 'match', pairs: [{left: 'потому что', right: 'союз'}, {left: 'ли', right: 'частица'}]},
      {kind: 'match', pairs: [{left: 'ой', right: 'междометие'}, {left: 'тик-так', right: 'звукоподражательное слово'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога-разбора в правильном порядке',
        speakers: {a: 'Учитель', b: 'Ученик'},
        lines: [
          {speaker: 'a', text: 'В предложении «Ах, как красиво!» — какая часть речи «ах»?'},
          {speaker: 'b', text: 'Междометие, оно выражает эмоцию.'},
          {speaker: 'a', text: 'А если бы вместо «ах» стояло «мяу»?'},
          {speaker: 'b', text: 'Тогда это звукоподражательное слово — оно имитирует звук, а не эмоцию.'}
        ]
      }
    ]
  },

  // ── 2. participles-gerunds ──────────────────────────────────────────────────────────────
  {
    slug: 'participles-gerunds',
    postTitle: 'Причастие и деепричастие: как отличить особые формы глагола',
    richContent: doc(
      p(
        ['Причастие и деепричастие — особые формы глагола: каждая совмещает его признаки с признаками другой части речи. ', []],
        ['Причастие', ['bold']],
        [' ведёт себя как прилагательное, ', []],
        ['деепричастие', ['bold']],
        [' — как наречие. Запомнить это соответствие — и почти вся тема закрыта.', []]
      ),
      h3('Причастие: глагол + прилагательное'),
      p(
        ['Причастие отвечает на вопросы ', []],
        ['какой? что делающий? что сделавший?', ['italic']],
        [' и изменяется по родам, числам и падежам, как обычное прилагательное: ', []],
        ['читающий, читающая, читающие, читающего', ['italic']],
        ['. Действительное причастие обозначает признак предмета, который сам совершает действие (', []],
        ['читающий мальчик', ['italic']],
        ['): суффиксы ', []],
        ['-ущ-/-ющ-/-ащ-/-ящ-', ['bold']],
        [' в настоящем времени и ', []],
        ['-вш-/-ш-', ['bold']],
        [' в прошедшем. Страдательное причастие обозначает признак предмета, над которым совершают действие (', []],
        ['прочитанная книга', ['italic']],
        ['): суффиксы ', []],
        ['-ем-/-ом-/-им-', ['bold']],
        [' в настоящем и ', []],
        ['-нн-/-енн-/-т-', ['bold']],
        [' в прошедшем.', []]
      ),
      h3('Деепричастие: глагол + наречие'),
      p(
        ['Деепричастие отвечает на вопросы ', []],
        ['что делая? что сделав?', ['italic']],
        [', не изменяется (как наречие) и всегда обозначает добавочное действие того же субъекта, что и главный глагол: ', []],
        ['он шёл, напевая', ['italic']],
        [' — идёт и одновременно поёт один и тот же «он».', []]
      ),
      bq(
        p(['Быстрая проверка: ', []], ['причастие', ['bold']], [' заменяется оборотом «который + глагол» — ', []], ['кипящая вода = вода, которая кипит.', ['italic']]),
        p(['У прилагательного такая замена невозможна: ', []], ['кипучая энергия', ['italic']], [' — это не «энергия, которая кипит», а постоянное свойство.', []])
      ),
      ul([
        [['Несовершенный вид деепричастия (действие одновременно с основным): суффиксы ', []], ['-а-/-я-', ['bold']], [' — ', []], ['напевая.', ['italic']]],
        [['Совершенный вид (действие предшествует основному): суффиксы ', []], ['-в-/-вши-/-ши-', ['bold']], [' — ', []], ['хлопнув.', ['italic']]]
      ]),
      table(
        ['', 'Причастие', 'Деепричастие'],
        [
          ['Отвечает на вопрос', 'какой? что делающий?', 'что делая? что сделав?'],
          ['Изменяется как', 'прилагательное (род, число, падеж)', 'наречие — не изменяется'],
          ['Обозначает', 'признак предмета по действию', 'добавочное действие того же субъекта'],
          ['Пример', 'читающий, прочитанный', 'читая, прочитав']
        ]
      )
    ),
    cheatTitle: 'Причастия и деепричастия',
    cheatSections: [
      {
        heading: 'Причастие = глагол + прилагательное',
        bullets: [
          'какой? что делающий?; изменяется по родам/числам/падежам.',
          'Действительное (само действует): наст. -ущ-/-ющ-/-ащ-/-ящ- (читающий); прош. -вш-/-ш- (читавший).',
          'Страдательное (действие над ним): наст. -ем-/-ом-/-им- (читаемый); прош. -нн-/-енн-/-т- (прочитанный).'
        ]
      },
      {
        heading: 'Деепричастие = глагол + наречие',
        bullets: [
          'что делая? что сделав?; не изменяется, добавочное действие.',
          'Несов. вид (одновременно): -а-/-я- (напевая). Сов. вид (предшествует): -в-/-вши-/-ши- (хлопнув).',
          'Причастие -> прилагательное: замена оборотом «который + глагол» (кипящая = которая кипит).'
        ]
      }
    ],
    cheatTable: {
      headers: ['', 'Причастие', 'Деепричастие'],
      colWidths: [110, 195, 190],
      rows: [
        ['Вопрос', 'какой? что делающий?', 'что делая? что сделав?'],
        ['Изменяется как', 'прилагательное', 'наречие (не изменяется)'],
        ['Пример', 'читающий, прочитанный', 'читая, прочитав']
      ]
    },
    shortTestTitle: 'Причастия и деепричастия: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Кипящая вода — причастие или прилагательное (можно заменить «которая кипит»)?', options: ['причастие', 'прилагательное'], correct: 0},
      {kind: 'choose', question: 'Он шёл, напевая песню — деепричастие или наречие (обозначает добавочное действие)?', options: ['деепричастие', 'наречие'], correct: 0},
      {kind: 'choose', question: 'Прочитанная книга — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 1},
      {kind: 'choose', question: 'Читающий мальчик — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 0},
      {kind: 'choose', question: 'Хлопнув дверью, он вышел — какой вид деепричастия (действие предшествует основному)?', options: ['совершенный', 'несовершенный'], correct: 0},
      {kind: 'match', pairs: [{left: 'читающий', right: 'какой? (причастие)'}, {left: 'читая', right: 'что делая? (деепричастие)'}]}
    ],
    largeTestTitle: 'Причастия и деепричастия: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Блестящий на солнце снег — причастие или прилагательное (есть зависимое слово «на солнце»)?', options: ['причастие', 'прилагательное'], correct: 0},
      {kind: 'choose', question: 'Блестящий ум — причастие или прилагательное (постоянный признак, замена невозможна)?', options: ['причастие', 'прилагательное'], correct: 1},
      {kind: 'choose', question: 'Пишущий сочинение ученик — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 0},
      {kind: 'choose', question: 'Написанное сочинение — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 1},
      {kind: 'choose', question: 'Рисуемая художником картина — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 1},
      {kind: 'choose', question: 'Летящий самолёт — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 0},
      {kind: 'choose', question: 'Он ответил, не задумываясь — деепричастие какого вида (действие одновременно)?', options: ['несовершенный', 'совершенный'], correct: 0},
      {kind: 'choose', question: 'Закрыв книгу, он встал — деепричастие какого вида (действие предшествует)?', options: ['несовершенный', 'совершенный'], correct: 1},
      {kind: 'choose', question: 'Задача решена — краткое причастие или краткое прилагательное (образовано от глагола «решить»)?', options: ['причастие', 'прилагательное'], correct: 0},
      {kind: 'choose', question: 'Строящийся дом — действительное или страдательное причастие (возвратное, само строится)?', options: ['действительное', 'страдательное'], correct: 0},
      {kind: 'choose', question: 'Ведомый учителем класс — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 1},
      {kind: 'match', pairs: [{left: 'сидя у окна', right: 'что делая? (деепричастие)'}, {left: 'вспыхнувший костёр', right: 'что сделавший? (причастие)'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Как отличить причастие «кипящая» от прилагательного «кипучая»?'},
          {speaker: 'b', text: 'Попробуй заменить оборотом «который + глагол»: кипящая вода = вода, которая кипит.'},
          {speaker: 'a', text: 'А «кипучая энергия» так не заменяется?'},
          {speaker: 'b', text: 'Именно — значит, это прилагательное, постоянный признак, а не причастие.'}
        ]
      }
    ]
  },

  // ── 3. noun-morphology (FILL_TEXT rebuild) ─────────────────────────────────────────────
  {
    slug: 'noun-morphology',
    postTitle: 'Имя существительное: род, число, падеж, склонение',
    richContent: doc(
      p(
        ['Имя существительное — самостоятельная часть речи, которая называет предмет и отвечает на вопросы ', []],
        ['кто? что?', ['italic']],
        ['. У него есть постоянные признаки — род и склонение — и непостоянные: падеж и число. Разница важна: постоянный признак не меняется, как бы вы ни склоняли слово; непостоянный — это то, что меняется от предложения к предложению.', []]
      ),
      h3('Род и склонение'),
      p(
        ['Род определяется по начальной форме (им. п., ед. ч.): ', []],
        ['мужской', ['bold']],
        [' — нулевое окончание (', []],
        ['стол, конь', ['italic']],
        ['), ', []],
        ['женский', ['bold']],
        [' — окончание -а/-я (', []],
        ['страна, земля', ['italic']],
        ['), ', []],
        ['средний', ['bold']],
        [' — окончание -о/-е (', []],
        ['окно, поле', ['italic']],
        ['). Есть и существительные общего рода — ', []],
        ['плакса, неряха, сирота', ['italic']],
        [' — они бывают и мужского, и женского рода в зависимости от того, о ком идёт речь.', []]
      ),
      p(
        ['1-е склонение — существительные женского и мужского рода на -а/-я (', []],
        ['страна, папа', ['italic']],
        ['). 2-е — мужской род с нулевым окончанием и средний род на -о/-е (', []],
        ['стол, окно', ['italic']],
        ['). 3-е — женский род с Ь на конце (', []],
        ['ночь, степь', ['italic']],
        ['). Дальше начинается интересное.', []]
      ),
      bq(
        p(
          ['Десять слов на ', []],
          ['-мя', ['bold']],
          [' (время, имя, племя, семя, стремя, темя, бремя, вымя, знамя, пламя) и слово ', []],
          ['путь', ['bold']],
          [' склоняются по-особому: в родительном, дательном и предложном падежах у них окончание -и, как у 3-го склонения, а в творительном — окончание -ем, как у 2-го: ', []],
          ['времени, но временем.', ['italic']]
        )
      ),
      h3('Падеж'),
      p(['Падеж показывает роль слова в предложении и определяется вопросом: именительный (кто? что?), родительный (кого? чего?), дательный (кому? чему?), винительный (кого? что?), творительный (кем? чем?), предложный (о ком? о чём?).', []]),
      table(
        ['Склонение', 'Какие существительные', 'Пример'],
        [
          ['1-е', 'жен./муж. род на -а/-я', 'страна, папа'],
          ['2-е', 'муж. род без окончания, ср. род на -о/-е', 'стол, окно'],
          ['3-е', 'жен. род с Ь на конце', 'ночь, степь'],
          ['Разносклоняемые', 'путь + 10 слов на -мя', 'время, имя, знамя...']
        ]
      )
    ),
    cheatTitle: 'Имя существительное',
    cheatSections: [
      {
        heading: 'Род и склонение (постоянные признаки)',
        bullets: [
          'Род (в им.п. ед.ч.): муж. — нулевое окончание (стол); жен. — -а/-я (страна); ср. — -о/-е (окно).',
          'Общий род: плакса, неряха, сирота — м. или ж. в зависимости от того, о ком речь.',
          '1 скл.: жен./муж. род на -а/-я (страна, папа). 2 скл.: муж. род без окончания + ср. род на -о/-е (стол, окно). 3 скл.: жен. род с Ь (ночь, степь).'
        ]
      },
      {
        heading: 'Разносклоняемые и падежи',
        bullets: [
          'путь + 10 слов на -мя (время, имя, племя, семя, стремя, темя, бремя, вымя, знамя, пламя).',
          'У слов на -мя: Р./Д./П.п. ед.ч. — окончание -и, как 3 скл. (времени); Т.п. — окончание -ем, как 2 скл. (временем).',
          'Падежи: И.п. кто? что?; Р.п. кого? чего?; Д.п. кому? чему?; В.п. кого? что?; Т.п. кем? чем?; П.п. о ком? о чём?'
        ]
      }
    ],
    cheatTable: {
      headers: ['Склонение', 'Какие сущ.', 'Пример'],
      colWidths: [130, 220, 145],
      rows: [
        ['1-е', 'жен./муж. род на -а/-я', 'страна, папа'],
        ['2-е', 'муж. род без окончания, ср. род на -о/-е', 'стол, окно'],
        ['3-е', 'жен. род с Ь на конце', 'ночь, степь'],
        ['Разносклоняемые', 'путь + 10 слов на -мя', 'время, знамя']
      ]
    },
    shortTestTitle: 'Имя существительное: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Мы долго говорили о врем', {gap: 'ени'}, ', когда ещё не было интернета.'],
          ['У этого плем', {gap: 'ени'}, ' нет письменности, зато есть красивые песни.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['За недолгое врем', {gap: 'енем'}, ' до отъезда мы успели попрощаться со всеми.'],
          ['Туристы шли по горному пут', {gap: 'и'}, ' почти без остановок.']
        ]
      },
      {kind: 'match', pairs: [{left: 'страна', right: '1-е скл.'}, {left: 'стол', right: '2-е скл.'}]},
      {kind: 'match', pairs: [{left: 'ночь', right: '3-е скл.'}, {left: 'время', right: 'разносклоняемое'}]},
      {kind: 'choose', question: 'Плакса, неряха, сирота — какой это род?', options: ['только мужской', 'только женский', 'общий'], correct: 2},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Почему «времени», но «временем» — это же одно и то же слово?'},
          {speaker: 'b', text: 'Слово «время» разносклоняемое: в Р./Д./П.п. окончание -и, как у 3-го склонения.'},
          {speaker: 'a', text: 'А в творительном падеже?'},
          {speaker: 'b', text: 'Там окончание -ем, как у 2-го склонения — отсюда и «временем».'}
        ]
      }
    ],
    largeTestTitle: 'Имя существительное: большой тест на склонения',
    largeTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Мы гуляли по стран', {gap: 'е'}, ', о которой давно мечтали.'],
          ['Дорога вела прямо к земл', {gap: 'е'}, ', заросшей высокой травой.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['На прямой лини', {gap: 'и'}, ' горизонта показался парусник.'],
          ['Ключи от квартиры лежали на письменном стол', {gap: 'е'}, '.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['В старом здани', {gap: 'и'}, ' пахло пылью и книгами.'],
          ['На площад', {gap: 'и'}, ' собралась целая толпа.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Ближе к ноч', {gap: 'и'}, ' стало заметно холоднее.'],
          ['У этого сем', {gap: 'ени'}, ' очень долгий срок прорастания.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Полк подошёл к знам', {gap: 'ени'}, ' с оркестром впереди.'],
          ['Все гордились знам', {gap: 'енем'}, ' своего полка.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Над костровым пламен', {gap: 'ем'}, ' поднимался лёгкий дымок.'],
          ['Без лишнего брем', {gap: 'ени'}, ' на плечах идти было гораздо легче.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['У этой коровы редкое вым', {gap: 'я'}, ' необычной формы.'],
          ['Нет пут', {gap: 'и'}, ' короче, чем через лес.']
        ]
      },
      {kind: 'match', pairs: [{left: 'страна', right: '1-е скл.'}, {left: 'папа', right: '1-е скл.'}]},
      {kind: 'match', pairs: [{left: 'стол', right: '2-е скл.'}, {left: 'окно', right: '2-е скл.'}]},
      {kind: 'match', pairs: [{left: 'ночь', right: '3-е скл.'}, {left: 'степь', right: '3-е скл.'}]},
      {kind: 'match', pairs: [{left: 'путь', right: 'разносклоняемое'}, {left: 'знамя', right: 'разносклоняемое'}]},
      {kind: 'choose', question: 'Слово «время» относится к какой группе существительных?', options: ['1-е склонение', 'разносклоняемое'], correct: 1},
      {kind: 'choose', question: 'У слов на -мя в творительном падеже какое окончание?', options: ['-и, как у 3-го склонения', '-ем, как у 2-го склонения'], correct: 1},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'К какому склонению относится слово «степь»?'},
          {speaker: 'b', text: 'Женский род, Ь на конце — это 3-е склонение.'},
          {speaker: 'a', text: 'А «стол»?'},
          {speaker: 'b', text: 'Мужской род, нулевое окончание — 2-е склонение.'}
        ]
      }
    ]
  },

  // ── 4. adjective-morphology ─────────────────────────────────────────────────────────────
  {
    slug: 'adjective-morphology',
    postTitle: 'Имя прилагательное: разряды и степени сравнения',
    richContent: doc(
      p(
        ['Имя прилагательное обозначает признак предмета и отвечает на вопросы ', []],
        ['какой? какая? какое? чей?', ['italic']],
        ['. По значению все прилагательные делятся на три разряда, и различать их — не формальность: от разряда зависит, есть ли у слова степени сравнения и краткая форма.', []]
      ),
      h3('Три разряда'),
      p(
        ['Качественные', ['bold']],
        [' обозначают признак, который может проявляться в большей или меньшей степени (', []],
        ['высокий, красивый, умный', ['italic']],
        ['). ', []],
        ['Относительные', ['bold']],
        [' обозначают признак через отношение к другому предмету, материалу, месту или времени (', []],
        ['деревянный стол', ['italic']],
        [' = стол из дерева). ', []],
        ['Притяжательные', ['bold']],
        [' обозначают принадлежность конкретному лицу или животному и отвечают на вопрос ', []],
        ['чей?', ['italic']],
        [' (', []],
        ['мамин платок, лисий хвост', ['italic']],
        [').', []]
      ),
      bq(
        p(['Проверка разряда: если признак можно усилить словом «очень» — прилагательное качественное. Если оно заменяется оборотом «из чего/для чего/когда» — относительное. Если отвечает на вопрос «чей?» — притяжательное.', []])
      ),
      p(
        ['Интересно, что один и тот же корень иногда даёт слова из ', []],
        ['разных', ['italic']],
        [' разрядов: ', []],
        ['золотой браслет', ['italic']],
        [' (относительное — «из золота») и ', []],
        ['золотой характер', ['italic']],
        [' (качественное, переносное значение — «очень хороший»).', []]
      ),
      h3('Степени сравнения'),
      p(
        ['Степени сравнения бывают только у качественных прилагательных. ', []],
        ['Сравнительная степень', ['bold']],
        [': простая форма образуется суффиксами -ее(-ей)/-е/-ше (', []],
        ['умнее, громче', ['italic']],
        ['), составная — словом «более/менее» + начальная форма (', []],
        ['более умный', ['italic']],
        ['). ', []],
        ['Превосходная степень', ['bold']],
        [': простая — суффиксами -ейш-/-айш- (', []],
        ['умнейший', ['italic']],
        ['), составная — «самый/наиболее» + начальная форма или сравнительная степень + «всех» (', []],
        ['самый умный, умнее всех', ['italic']],
        [').', []]
      ),
      table(
        ['Разряд', 'Признак/вопрос', 'Степени сравнения'],
        [
          ['Качественное', 'можно усилить «очень» (высокий)', 'есть'],
          ['Относительное', 'через отношение к предмету/материалу (деревянный)', 'нет'],
          ['Притяжательное', 'чей? (мамин, лисий)', 'нет']
        ]
      )
    ),
    cheatTitle: 'Имя прилагательное',
    cheatSections: [
      {
        heading: 'Разряды по значению',
        bullets: [
          'Качественные: признак в большей/меньшей степени (высокий, красивый) — образуют степени сравнения и краткую форму.',
          'Относительные: признак через отношение к предмету/материалу/времени (деревянный, вчерашний) — степеней сравнения нет.',
          'Притяжательные: чей? — принадлежность лицу/животному (мамин, лисий, волчья).',
          'Одно слово в разных значениях — разные разряды: золотой браслет (относит.), золотой характер (качеств.).'
        ]
      },
      {
        heading: 'Степени сравнения (только у качественных)',
        bullets: [
          'Сравнительная: простая — -ее/-ей/-е/-ше (умнее, громче); составная — более/менее + слово (более умный).',
          'Превосходная: простая — -ейш-/-айш- (умнейший); составная — самый/наиболее + слово, или сравнит. степень + всех.'
        ]
      }
    ],
    cheatTable: {
      headers: ['Разряд', 'Признак/вопрос', 'Степени сравнения'],
      colWidths: [110, 260, 125],
      rows: [
        ['Качественное', 'усиливается «очень» (высокий)', 'есть'],
        ['Относительное', 'из чего/для чего (деревянный)', 'нет'],
        ['Притяжательное', 'чей? (мамин, лисий)', 'нет']
      ]
    },
    shortTestTitle: 'Имя прилагательное: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Деревянный стол — какой разряд (стол из дерева)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 1},
      {kind: 'choose', question: 'Высокий дом — какой разряд (можно сказать «очень высокий»)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 0},
      {kind: 'choose', question: 'Лисий хвост — какой разряд (хвост чей?)', options: ['качественное', 'относительное', 'притяжательное'], correct: 2},
      {kind: 'choose', question: 'Умнее — простая или составная форма сравнительной степени?', options: ['простая', 'составная'], correct: 0},
      {kind: 'choose', question: 'Более умный — простая или составная форма сравнительной степени?', options: ['простая', 'составная'], correct: 1},
      {kind: 'match', pairs: [{left: 'мамин', right: 'притяжательное'}, {left: 'каменный', right: 'относительное'}]}
    ],
    largeTestTitle: 'Имя прилагательное: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Мамин платок — какой разряд?', options: ['качественное', 'относительное', 'притяжательное'], correct: 2},
      {kind: 'choose', question: 'Вчерашний день — какой разряд (день, который был вчера)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 1},
      {kind: 'choose', question: 'Золотой браслет (из золота) — какой разряд?', options: ['качественное', 'относительное', 'притяжательное'], correct: 1},
      {kind: 'choose', question: 'Золотой характер (переносное значение «очень хороший») — какой разряд?', options: ['качественное', 'относительное', 'притяжательное'], correct: 0},
      {kind: 'choose', question: 'Волчья нора — какой разряд (нора чья?)', options: ['качественное', 'относительное', 'притяжательное'], correct: 2},
      {kind: 'choose', question: 'Красивый пейзаж — какой разряд (можно усилить «очень»)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 0},
      {kind: 'choose', question: 'Каменный дом (дом из камня) — какой разряд?', options: ['качественное', 'относительное', 'притяжательное'], correct: 1},
      {kind: 'choose', question: 'Высочайший — простая или составная форма превосходной степени?', options: ['простая', 'составная'], correct: 0},
      {kind: 'choose', question: 'Самый умный — простая или составная форма превосходной степени?', options: ['простая', 'составная'], correct: 1},
      {kind: 'choose', question: 'Умнее всех — это составная превосходная степень (сравнительная форма + «всех»)?', options: ['да', 'нет'], correct: 0},
      {kind: 'choose', question: 'Есть ли степени сравнения у прилагательного «стеклянный» (относительное)?', options: ['да', 'нет'], correct: 1},
      {kind: 'match', pairs: [{left: 'волчья', right: 'притяжательное'}, {left: 'стеклянный', right: 'относительное'}]},
      {kind: 'match', pairs: [{left: 'добрый', right: 'качественное'}, {left: 'вчерашний', right: 'относительное'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Слово «золотой» — это качественное или относительное прилагательное?'},
          {speaker: 'b', text: 'Зависит от контекста: золотой браслет — относительное, «из золота».'},
          {speaker: 'a', text: 'А золотой характер?'},
          {speaker: 'b', text: 'Тут переносное значение — «очень хороший», это уже качественное, можно сказать «очень золотой».'}
        ]
      }
    ]
  },

  // ── 5. verb-morphology (FILL_TEXT rebuild — the garbled example from the brief) ─────────
  {
    slug: 'verb-morphology',
    postTitle: 'Глагол: вид, время, спряжение, наклонение, переходность',
    richContent: doc(
      p(
        ['Глагол обозначает действие или состояние предмета и отвечает на вопросы ', []],
        ['что делать? что сделать?', ['italic']],
        ['. Это самая грамматически насыщенная часть речи в русском языке — у неё больше категорий, чем у любой другой, и каждая из них решает свою задачу.', []]
      ),
      h3('Вид и время'),
      p(
        ['Несовершенный вид', ['bold']],
        [' отвечает на вопрос ', []],
        ['что делать?', ['italic']],
        [' и обозначает действие без указания на результат (', []],
        ['писать, читать', ['italic']],
        ['). ', []],
        ['Совершенный вид', ['bold']],
        [' отвечает на вопрос ', []],
        ['что сделать?', ['italic']],
        [' и обозначает законченное действие с результатом (', []],
        ['написать, прочитать', ['italic']],
        ['). Время есть только у глаголов в изъявительном наклонении, и у совершенного вида будущее время простое (', []],
        ['напишу', ['italic']],
        ['), а у несовершенного — составное (', []],
        ['буду писать', ['italic']],
        [').', []]
      ),
      h3('Спряжение — самая частая ошибка'),
      p(
        ['Спряжение — это изменение глагола по лицам и числам в настоящем/будущем времени. ', []],
        ['II спряжение', ['bold']],
        [' — все глаголы на ', []],
        ['-ить', ['italic']],
        [' (кроме брить, стелить, зиждиться) и 11 глаголов-исключений: ', []],
        ['гнать, держать, дышать, слышать, видеть, ненавидеть, зависеть, терпеть, обидеть, вертеть, смотреть', ['italic']],
        ['. ', []],
        ['I спряжение', ['bold']],
        [' — все остальные глаголы.', []]
      ),
      bq(
        p(['Быстро запомнить 11 исключений помогает старая школьная рифмовка:', []]),
        p(
          [
            'Гнать, дышать, держать, обидеть, слышать, видеть и вертеть, а ещё зависеть, ненавидеть и терпеть, смотреть.',
            ['italic']
          ]
        )
      ),
      p(
        ['Отдельно стоят ', []],
        ['разноспрягаемые глаголы', ['bold']],
        [' хотеть и бежать — в разных формах они спрягаются то по I, то по II спряжению: ', []],
        ['хочу, хочешь, хочет', ['italic']],
        [' (I), но ', []],
        ['хотим, хотите, хотят', ['italic']],
        [' (II); ', []],
        ['бегу, бежишь, бежит, бежим, бежите', ['italic']],
        [' (II), но ', []],
        ['бегут', ['italic']],
        [' (I).', []]
      ),
      h3('Наклонение и переходность'),
      p(
        ['Наклонение показывает отношение действия к реальности: ', []],
        ['изъявительное', ['bold']],
        [' — действие реально происходит (', []],
        ['пишу, писал, напишу', ['italic']],
        ['), ', []],
        ['условное', ['bold']],
        [' — возможно при условии (', []],
        ['написал бы', ['italic']],
        ['), ', []],
        ['повелительное', ['bold']],
        [' — приказ или просьба (', []],
        ['напиши!', ['italic']],
        ['). Переходность показывает, принимает ли глагол прямое дополнение в винительном падеже без предлога: ', []],
        ['читать книгу', ['italic']],
        [' — переходный, ', []],
        ['идти, радоваться', ['italic']],
        [' — непереходный (сюда же все возвратные глаголы на -ся/-сь).', []]
      ),
      table(
        ['Спряжение', 'Какие глаголы', 'Окончания'],
        [
          ['I', 'все, кроме на -ить, и не входящие в 11 искл.', '-ешь, -ет, -ем, -ете, -ут/-ют'],
          ['II', 'на -ить (кроме брить, стелить, зиждиться) + 11 исключений', '-ишь, -ит, -им, -ите, -ат/-ят'],
          ['Разноспрягаемые', 'хотеть, бежать', 'часть форм по I, часть по II']
        ]
      )
    ),
    cheatTitle: 'Глагол',
    cheatSections: [
      {
        heading: 'Вид, время, спряжение',
        bullets: [
          'Вид: несов. — что делать? (писать, длится); сов. — что сделать? (написать, есть результат).',
          'Время — только у изъявит. наклонения: буд. простое у сов. вида (напишу), составное у несов. (буду писать).',
          'II спряжение: глаголы на -ить (кроме брить, стелить, зиждиться) + 11 искл. (гнать, держать, дышать, слышать, видеть, ненавидеть, зависеть, терпеть, обидеть, вертеть, смотреть) — окончания -ит/-ат(-ят).',
          'I спряжение — все остальные глаголы, окончания -ет/-ут(-ют).'
        ]
      },
      {
        heading: 'Разноспрягаемые, наклонение, переходность',
        bullets: [
          'Разноспрягаемые: хотеть (хочу-хочешь-хочет по I, хотим-хотите-хотят по II), бежать (бегу...бежите по II, бегут по I).',
          'Наклонение: изъявит. (пишу/писал/напишу); условное (написал бы); повелительное (напиши!).',
          'Переходность: переходный + сущ. в В.п. без предлога (читать книгу); непереходный — без дополнения (идти), сюда же все на -ся/-сь.'
        ]
      }
    ],
    cheatTable: {
      headers: ['Спряжение', 'Какие глаголы', 'Окончания'],
      colWidths: [95, 260, 140],
      rows: [
        ['I', 'все, кроме на -ить и 11 искл.', '-ешь, -ет, -ут/-ют'],
        ['II', 'на -ить (кроме брить, стелить) + 11 искл.', '-ишь, -ит, -ат/-ят'],
        ['Разноспряг.', 'хотеть, бежать', 'часть форм по I, часть по II']
      ]
    },
    shortTestTitle: 'Глагол: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Ты каждый вечер пиш', {gap: 'ешь'}, ' длинные письма бабушке, а она внимательно чита', {gap: 'ет'}, ' их вслух.'],
          ['Мы хот', {gap: 'им'}, ' сегодня успеть на вокзал, а вы всё ещё беж', {gap: 'ите'}, ' через парк.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Мальчик, который терп', {gap: 'ит'}, ' боль молча, ведёт себя взрослее того, кто гон', {gap: 'ит'}, ' лошадь без жалости.'],
          ['Она вид', {gap: 'ит'}, ' всё насквозь, а они дыш', {gap: 'ат'}, ' свежим воздухом после дождя.']
        ]
      },
      {kind: 'choose', question: 'Она читала книгу весь вечер, но так и не дочитала — глагол «дочитала» какого вида?', options: ['несовершенный', 'совершенный'], correct: 1},
      {kind: 'choose', question: 'К какому спряжению относится глагол «гнать» (входит в 11 исключений)?', options: ['I', 'II'], correct: 1},
      {kind: 'match', pairs: [{left: 'смотреть', right: 'II спряжение (исключение)'}, {left: 'читать', right: 'I спряжение'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Настя', b: 'Олег'},
        lines: [
          {speaker: 'a', text: 'Пришёл бы ты пораньше, мы бы успели в кино.'},
          {speaker: 'b', text: 'Прости, у меня было столько дел!'},
          {speaker: 'a', text: 'Ладно, приходи завтра к шести.'},
          {speaker: 'b', text: 'Хорошо, приду обязательно.'}
        ]
      }
    ],
    largeTestTitle: 'Глагол: большой тест на спряжение и исключения',
    largeTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Она чита', {gap: 'ет'}, ' книгу, а они чита', {gap: 'ют'}, ' журналы.'],
          ['Он гон', {gap: 'ит'}, ' стадо к реке, а они гон', {gap: 'ят'}, ' его ещё быстрее.'],
          ['Ты держ', {gap: 'ишь'}, ' удочку крепко, а они держ', {gap: 'ат'}, ' сеть у самого берега.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Парикмахер бре', {gap: 'ет'}, ' бороду быстро, а его коллеги бре', {gap: 'ют'}, ' клиентов ещё быстрее.'],
          ['Она акккуратно стел', {gap: 'ет'}, ' свежую скатерть перед приходом гостей.'],
          ['Они беж', {gap: 'ут'}, ' к финишу изо всех сил, а он беж', {gap: 'ит'}, ' чуть позади всех.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Он терп', {gap: 'ит'}, ' неудобства стойко, а она завис', {gap: 'ит'}, ' от расписания поездов.'],
          ['Ты дыш', {gap: 'ишь'}, ' глубоко перед стартом, а они смотр', {gap: 'ят'}, ' на табло с результатами.'],
          ['Она хо', {gap: 'чет'}, ' горячего чаю, а мы хот', {gap: 'им'}, ' кофе с молоком.']
        ]
      },
      {kind: 'choose', question: 'Он ответил, не задумываясь — деепричастие или наречие обозначает добавочное действие?', options: ['деепричастие', 'наречие'], correct: 0},
      {kind: 'choose', question: 'Написал бы он письмо пораньше — какое это наклонение?', options: ['изъявительное', 'условное', 'повелительное'], correct: 1},
      {kind: 'choose', question: 'Напиши мне, как приедешь — какое это наклонение?', options: ['изъявительное', 'условное', 'повелительное'], correct: 2},
      {kind: 'choose', question: 'Читать книгу — переходный или непереходный глагол (есть сущ. в В.п. без предлога)?', options: ['переходный', 'непереходный'], correct: 0},
      {kind: 'choose', question: 'Радоваться (возвратный, на -ся) — переходный или непереходный глагол?', options: ['переходный', 'непереходный'], correct: 1},
      {kind: 'choose', question: 'Хотеть в форме «хотим» спрягается по какому спряжению?', options: ['I', 'II'], correct: 1},
      {kind: 'match', pairs: [{left: 'брить', right: 'I спряжение (искл. на -ить)'}, {left: 'видеть', right: 'II спряжение (искл.)'}]},
      {kind: 'match', pairs: [{left: 'написал бы', right: 'условное наклонение'}, {left: 'напиши', right: 'повелительное наклонение'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога-разбора в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Почему «стелет» пишется через Е, если глагол «стелить» на -ить?'},
          {speaker: 'b', text: 'Стелить — одно из трёх исключений из общего правила про -ить, наряду с брить и зиждиться.'},
          {speaker: 'a', text: 'То есть оно спрягается по I спряжению?'},
          {speaker: 'b', text: 'Именно — стелет, стелют, а не стелит, стелят.'}
        ]
      }
    ]
  },

  // ── 6. pronoun-morphology ───────────────────────────────────────────────────────────────
  {
    slug: 'pronoun-morphology',
    postTitle: 'Местоимение: разряды по значению',
    richContent: doc(
      p(
        ['Местоимение не называет предмет, признак или количество, а лишь ', []],
        ['указывает', ['italic']],
        [' на них, замещая существительное, прилагательное или числительное в тексте: «Аня открыла книгу. Она читала её» звучит естественнее, чем повтор «Аня... книгу».', []]
      ),
      h3('Девять разрядов'),
      p(
        ['Личные', ['bold']],
        [' (я, ты, он, она, оно, мы, вы, они) указывают на участников речи. ', []],
        ['Возвратное', ['bold']],
        [' (себя) указывает, что действие направлено на самого производителя действия, и не имеет формы именительного падежа. ', []],
        ['Притяжательные', ['bold']],
        [' (мой, твой, свой, наш, ваш, его, её, их) указывают на принадлежность.', []]
      ),
      p(
        ['Указательные', ['bold']],
        [' (этот, тот, такой, таков, столько) выделяют предмет среди других. ', []],
        ['Определительные', ['bold']],
        [' (весь, всякий, каждый, любой, сам, самый, иной, другой) придают значение обобщения. ', []],
        ['Вопросительные', ['bold']],
        [' используются в вопросе, а те же слова без вопроса, но для связи частей сложного предложения, называются ', []],
        ['относительными', ['bold']],
        [' — важна функция слова, а не его форма.', []]
      ),
      bq(
        p(
          [
            'Отрицательные местоимения — единственная тема, где ударение меняет написание: приставка не- пишется под ударением, ни- — без ударения. ',
            []
          ],
          ['Некого спросить — никого не спросил.', ['italic']]
        )
      ),
      p(
        ['Неопределённые', ['bold']],
        [' (некто, нечто, кто-то, что-либо, кое-кто) указывают на неизвестный или неважный предмет; образуются от вопросительных приставками ', []],
        ['не-/кое-', ['italic']],
        [' или суффиксами ', []],
        ['-то/-либо/-нибудь', ['italic']],
        ['.', []]
      ),
      table(
        ['Разряд', 'Примеры'],
        [
          ['Личные', 'я, ты, он/она/оно, мы, вы, они'],
          ['Возвратное', 'себя'],
          ['Притяжательные', 'мой, твой, свой, наш, ваш, его, её, их'],
          ['Указательные', 'этот, тот, такой, таков, столько'],
          ['Определительные', 'весь, всякий, каждый, любой, сам, самый, иной'],
          ['Вопросительные/относительные', 'кто, что, какой, чей, сколько, который'],
          ['Неопределённые', 'некто, нечто, кто-то, что-либо, кое-кто'],
          ['Отрицательные', 'никто, ничто, никакой, ничей, нисколько']
        ]
      )
    ),
    cheatTitle: 'Местоимение',
    cheatSections: [
      {
        heading: 'Личные, возвратное, притяжательные',
        bullets: [
          'Личные: я, ты, он/она/оно, мы, вы, они — указывают на участников речи.',
          'Возвратное: себя — нет им.п., рода, числа; действие направлено на производителя.',
          'Притяжательные: мой, твой, свой, наш, ваш, его, её, их — принадлежность.'
        ]
      },
      {
        heading: 'Указательные, определительные, вопросительные и далее',
        bullets: [
          'Указательные: этот, тот, такой, таков, столько. Определительные: весь, всякий, каждый, любой, сам, самый, иной.',
          'Вопросительные (в вопросе) и относительные (для связи частей сложного предложения) — одни и те же слова: кто, что, какой, чей, сколько.',
          'Неопределённые: некто, нечто, кто-то — приставки не-/кое-, суффиксы -то/-либо/-нибудь. Отрицательные: не- под ударением (некого), ни- без ударения (никого).'
        ]
      }
    ],
    cheatTable: {
      headers: ['Разряд', 'Примеры'],
      colWidths: [180, 315],
      rows: [
        ['Личные', 'я, ты, он/она/оно, мы, вы, они'],
        ['Возвратное', 'себя'],
        ['Притяжательные', 'мой, твой, свой, наш, ваш, его, её, их'],
        ['Указательные', 'этот, тот, такой, таков, столько'],
        ['Определительные', 'весь, всякий, каждый, любой, сам'],
        ['Вопросит./относит.', 'кто, что, какой, чей, сколько, который'],
        ['Неопределённые', 'некто, нечто, кто-то, что-либо'],
        ['Отрицательные', 'никто, ничто, никакой, ничей']
      ]
    },
    shortTestTitle: 'Местоимение: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [{left: 'я', right: 'личное'}, {left: 'себя', right: 'возвратное'}]},
      {kind: 'match', pairs: [{left: 'мой', right: 'притяжательное'}, {left: 'этот', right: 'указательное'}]},
      {kind: 'match', pairs: [{left: 'весь', right: 'определительное'}, {left: 'кто', right: 'вопросительное'}]},
      {kind: 'match', pairs: [{left: 'кто-то', right: 'неопределённое'}, {left: 'никто', right: 'отрицательное'}]},
      {kind: 'match', pairs: [{left: 'каждый', right: 'определительное'}, {left: 'наш', right: 'притяжательное'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Учитель', b: 'Ученик'},
        lines: [
          {speaker: 'a', text: 'Некого спросить или никого не спросил — где правильно писать «не», а где «ни»?'},
          {speaker: 'b', text: 'Не- пишется под ударением: нЕкого спросить.'},
          {speaker: 'a', text: 'А без ударения?'},
          {speaker: 'b', text: 'Тогда ни-: никогО не спросил.'}
        ]
      }
    ],
    largeTestTitle: 'Местоимение: большой тест на все разряды',
    largeTestBlocks: [
      {kind: 'match', pairs: [{left: 'она', right: 'личное'}, {left: 'они', right: 'личное'}]},
      {kind: 'match', pairs: [{left: 'твой', right: 'притяжательное'}, {left: 'свой', right: 'притяжательное'}]},
      {kind: 'match', pairs: [{left: 'такой', right: 'указательное'}, {left: 'таков', right: 'указательное'}]},
      {kind: 'match', pairs: [{left: 'сам', right: 'определительное'}, {left: 'самый', right: 'определительное'}]},
      {kind: 'match', pairs: [{left: 'который', right: 'относительное'}, {left: 'какой', right: 'вопросительное'}]},
      {kind: 'match', pairs: [{left: 'нечто', right: 'неопределённое'}, {left: 'некоторый', right: 'неопределённое'}]},
      {kind: 'match', pairs: [{left: 'ничто', right: 'отрицательное'}, {left: 'никакой', right: 'отрицательное'}]},
      {kind: 'match', pairs: [{left: 'несколько', right: 'неопределённое'}, {left: 'кое-кто', right: 'неопределённое'}]},
      {kind: 'match', pairs: [{left: 'ничей', right: 'отрицательное'}, {left: 'нисколько', right: 'отрицательное'}]},
      {kind: 'match', pairs: [{left: 'иной', right: 'определительное'}, {left: 'другой', right: 'определительное'}]},
      {kind: 'match', pairs: [{left: 'вы', right: 'личное'}, {left: 'мы', right: 'личное'}]},
      {kind: 'match', pairs: [{left: 'его', right: 'притяжательное'}, {left: 'их', right: 'притяжательное'}]},
      {kind: 'match', pairs: [{left: 'что-либо', right: 'неопределённое'}, {left: 'кто-нибудь', right: 'неопределённое'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Учитель', b: 'Ученик'},
        lines: [
          {speaker: 'a', text: 'В предложении «Кто пришёл?» слово «кто» — какого разряда?'},
          {speaker: 'b', text: 'Вопросительное — стоит в вопросе.'},
          {speaker: 'a', text: 'А в «Я не знаю, кто пришёл»?'},
          {speaker: 'b', text: 'Тут та же форма, но функция другая — связывает части сложного предложения, значит, относительное.'}
        ]
      }
    ]
  },

  // ── 7. numeral-morphology (FILL_TEXT rebuild) ──────────────────────────────────────────
  {
    slug: 'numeral-morphology',
    postTitle: 'Имя числительное: разряды и склонение сложных форм',
    richContent: doc(
      p(
        ['Имя числительное обозначает количество или порядок предметов при счёте и отвечает на вопросы ', []],
        ['сколько? который?', ['italic']],
        ['. Это одна из самых компактных частей речи по словарю — и одна из самых капризных по склонению.', []]
      ),
      h3('Разряды'),
      p(
        ['Количественные', ['bold']],
        [' (сколько? — пять, сто) делятся на целые (', []],
        ['пять', ['italic']],
        ['), дробные (', []],
        ['две пятых, полтора', ['italic']],
        [') и собирательные (', []],
        ['двое, трое, четверо', ['italic']],
        [' — сочетаются только с существительными мужского рода, словом «дети» и названиями детёнышей животных). ', []],
        ['Порядковые', ['bold']],
        [' (который? — пятый, сотый) склоняются как прилагательные.', []]
      ),
      p(
        ['По составу числительные бывают простые (', []],
        ['пять', ['italic']],
        ['), сложные — одно слово, два корня (', []],
        ['пятьдесят', ['italic']],
        [') и составные — несколько слов (', []],
        ['сто двадцать три', ['italic']],
        [').', []]
      ),
      bq(
        p(
          ['Главное правило склонения: у сложного числительного изменяются ', []],
          ['обе части', ['bold']],
          [' — ', []],
          ['пятьюдесятью', ['italic']],
          ['. У составного числительного склоняется ', []],
          ['каждое слово по отдельности', ['bold']],
          [' — ', []],
          ['тремястами двадцатью тремя рублями', ['italic']],
          [' — три слова, три окончания.', []]
        )
      ),
      p(
        ['Особый случай — слово ', []],
        ['полтора', ['bold']],
        [': у него всего две падежные формы — полтора/полторы (им./вин.) и полутора (все остальные падежи). А у составного порядкового числительного при склонении изменяется только последнее слово: ', []],
        ['в тысяча девятьсот сорок пятом году', ['italic']],
        [' — изменилось только «сорок пятом».', []]
      ),
      table(
        ['Разряд', 'Вопрос', 'Пример'],
        [
          ['Количественное (целое)', 'сколько?', 'пять'],
          ['Дробное', 'сколько?', 'две пятых, полтора'],
          ['Собирательное', 'сколько? (только с м.р./детьми)', 'двое, трое'],
          ['Порядковое', 'который?', 'пятый']
        ]
      )
    ),
    cheatTitle: 'Имя числительное',
    cheatSections: [
      {
        heading: 'Разряды по значению и составу',
        bullets: [
          'Количественные — сколько? (пять); порядковые — который? (пятый).',
          'Количественные делятся на: целые (пять), дробные (две пятых, полтора), собирательные (двое, трое — с сущ. м.р., детьми, детёнышами).',
          'По составу: простые (пять), сложные — 1 слово 2 корня (пятьдесят), составные — неск. слов (сто двадцать три).'
        ]
      },
      {
        heading: 'Склонение сложных и составных форм',
        bullets: [
          'Сложное числительное: изменяются ОБЕ части — пятьюдесятью.',
          'Составное числительное: склоняется КАЖДОЕ слово — тремястами двадцатью тремя.',
          'Полтора/полторы — только в им./вин.п.; во всех остальных падежах — полутора.',
          'Составное порядковое: изменяется только ПОСЛЕДНЕЕ слово — в тысяча девятьсот сорок пятом году.'
        ]
      }
    ],
    cheatTable: {
      headers: ['Разряд', 'Вопрос', 'Пример'],
      colWidths: [165, 165, 165],
      rows: [
        ['Количественное (целое)', 'сколько?', 'пять'],
        ['Дробное', 'сколько?', 'две пятых, полтора'],
        ['Собирательное', 'сколько? (с м.р./детьми)', 'двое, трое'],
        ['Порядковое', 'который?', 'пятый']
      ]
    },
    shortTestTitle: 'Имя числительное: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Учительница обрадовалась п', {gap: 'яти'}, ' новым книгам для библиотеки.'],
          ['Он рисовал шест', {gap: 'ью'}, ' карандашами сразу, чтобы успеть до звонка.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Поезд отправлялся уже через восьм', {gap: 'и'}, ' часов после нашего приезда.'],
          ['Мы расплатились пятьюдесят', {gap: 'ью'}, ' рублями и получили сдачу.']
        ]
      },
      {kind: 'fill', sentences: [['Экскурсия заняла около п', {gap: 'олутора'}, ' часов и понравилась всем.']]},
      {kind: 'match', pairs: [{left: 'пять', right: 'количественное'}, {left: 'пятый', right: 'порядковое'}]},
      {kind: 'match', pairs: [{left: 'двое', right: 'собирательное'}, {left: 'полтора', right: 'дробное'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Как правильно: «полтора часа» или «полутора часа»?'},
          {speaker: 'b', text: 'В именительном и винительном падежах — «полтора»: прошло полтора часа.'},
          {speaker: 'a', text: 'А в остальных падежах?'},
          {speaker: 'b', text: 'Только «полутора» — например, «в течение полутора часов».'}
        ]
      }
    ],
    largeTestTitle: 'Имя числительное: большой тест на склонение сложных и составных форм',
    largeTestBlocks: [
      {
        kind: 'fill',
        sentences: [
          ['Билет на концерт стоил девяност', {gap: 'а'}, ' рублей, но нам сделали скидку.'],
          ['В библиотеке не хватало ст', {gap: 'а'}, ' книг для нового набора.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Учитель обратился к дв', {gap: 'умстам'}, ' ученикам сразу на общем собрании.'],
          ['Мы расплатились четырьмяст', {gap: 'ами'}, ' рублями и ещё остались должны.']
        ]
      },
      {
        kind: 'fill',
        sentences: [['За аренду зала заплатили сем', {gap: 'ьюстами'}, ' метрами ткани — так рассчитывался бартер.']]
      },
      {
        kind: 'fill',
        sentences: [
          ['Организаторы расплатились ', {gap: 'тремястами'}, ' двадцатью ', {gap: 'тремя'}, ' рублями за аренду сцены.'],
          ['На поляне паслось дво', {gap: 'е'}, ' жеребят и четвер', {gap: 'о'}, ' щенят.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Дедушка родился в тысяча девятьсот сорок пят', {gap: 'ом'}, ' году, в самом конце войны.'],
          ['Этот фестиваль пройдёт уже в две тысячи двадцать четвёрт', {gap: 'ом'}, ' году.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Рецепт требовал полтор', {gap: 'ы'}, ' ложки сахара и щепотку соли.'],
          ['Приз распределили между тр', {gap: 'идцатью тремя'}, ' участниками поровну.']
        ]
      },
      {
        kind: 'fill',
        sentences: [
          ['Библиотека выдала книги п', {gap: 'ятидесяти шести'}, ' читателям за один день.'],
          ['На весах было ровно девят', {gap: 'ьюстами'}, ' граммами муки больше нормы.']
        ]
      },
      {kind: 'match', pairs: [{left: 'пять', right: 'простое'}, {left: 'пятьдесят', right: 'сложное'}]},
      {kind: 'match', pairs: [{left: 'сто двадцать три', right: 'составное'}, {left: 'десятый', right: 'порядковое'}]},
      {kind: 'match', pairs: [{left: 'двое', right: 'собирательное'}, {left: 'две пятых', right: 'дробное'}]},
      {kind: 'choose', question: 'В сложном числительном «пятьюдесятью» сколько частей изменилось при склонении?', options: ['одна', 'обе'], correct: 1},
      {kind: 'choose', question: 'В составном числительном «тремястами двадцатью тремя» сколько слов изменилось?', options: ['одно', 'каждое слово'], correct: 1},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога-разбора в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: 'Как склонять «сто двадцать три» в творительном падеже?'},
          {speaker: 'b', text: 'Это составное числительное — склоняем каждое слово по отдельности.'},
          {speaker: 'a', text: 'Получится «стами двадцатью тремя»?'},
          {speaker: 'b', text: 'Именно так — три слова, три окончания, ни одно не остаётся в начальной форме.'}
        ]
      }
    ]
  },

  // ── 8. adverb-morphology ────────────────────────────────────────────────────────────────
  {
    slug: 'adverb-morphology',
    postTitle: 'Наречие: разряды, степени сравнения, отличие от слов категории состояния',
    richContent: doc(
      p(
        ['Наречие — самостоятельная ', []],
        ['неизменяемая', ['bold']],
        [' часть речи: оно обозначает признак действия, признака или предмета и отвечает на вопросы ', []],
        ['как? когда? где? куда? откуда? почему? зачем?', ['italic']],
        ['. Неизменяемость — его главное отличие от прилагательного.', []]
      ),
      h3('Разряды и степени сравнения'),
      p(
        ['По значению наречия делятся на ', []],
        ['определительные', ['bold']],
        [' (качество, способ, мера: ', []],
        ['быстро, весело, вдвое', ['italic']],
        [') и ', []],
        ['обстоятельственные', ['bold']],
        [' (время, место, причина, цель: ', []],
        ['вчера, издалека, сгоряча, назло', ['italic']],
        ['). Качественные наречия на -о/-е образуют степени сравнения так же, как прилагательные: сравнительная — простая (', []],
        ['быстрее', ['italic']],
        [') или составная (', []],
        ['более быстро', ['italic']],
        ['); превосходная — почти всегда составная (', []],
        ['быстрее всех', ['italic']],
        [').', []]
      ),
      h3('Ловушка на -о: три разных слова в одной форме'),
      p(
        ['Наречие на -о легко спутать с кратким прилагательным среднего рода и словом категории состояния — формы могут выглядеть одинаково. Спасает только один приём: посмотреть, ', []],
        ['к чему относится', ['italic']],
        [' слово и есть ли в предложении подлежащее.', []]
      ),
      bq(
        p(['Он говорил ', []], ['(как?)', ['italic']], ' весело — наречие, относится к глаголу, обстоятельство.'),
        p(['Лицо было ', []], ['(каково?)', ['italic']], ' весело — краткое прилагательное, относится к «лицу», сказуемое.'),
        p('На улице было весело — слово категории состояния: подлежащего нет вообще, это безличное предложение.')
      ),
      table(
        ['', 'Наречие', 'Кр. прилагательное', 'Слово состояния'],
        [
          ['Относится к', 'глаголу', 'существительному', 'нет подлежащего'],
          ['Роль в предложении', 'обстоятельство', 'сказуемое', 'сказуемое (безличное)'],
          ['Изменяется', 'нет', 'по родам/числам', 'нет'],
          ['Пример', 'говорил весело', 'лицо было весело', 'было весело (на улице)']
        ]
      )
    ),
    cheatTitle: 'Наречие',
    cheatSections: [
      {
        heading: 'Разряды и степени сравнения',
        bullets: [
          'Наречие — неизменяемая часть речи: как? когда? где? куда? откуда? почему? зачем?',
          'Определительные (качество/способ/мера): быстро, весело, вдвое, очень. Обстоятельственные: времени (вчера), места (издалека), причины (сгоряча), цели (назло).',
          'Степени сравнения (от кач. наречий на -о/-е): сравнит. простая (быстрее), составная (более быстро); превосх. — почти всегда составная (быстрее всех).'
        ]
      },
      {
        heading: 'Наречие vs краткое прилагательное vs слово состояния',
        bullets: [
          'Говорил (как?) весело — наречие, относится к глаголу, обстоятельство.',
          'Лицо было (каково?) весело — краткое прилагательное, относится к сущ., сказуемое, есть род/число.',
          'На улице было весело (без подлежащего) — слово категории состояния, обозначает состояние среды.'
        ]
      }
    ],
    cheatTable: {
      headers: ['', 'Наречие', 'Кр. прилаг.', 'Слово сост.'],
      colWidths: [110, 135, 135, 115],
      rows: [
        ['Относится к', 'глаголу', 'сущ.', 'нет подлеж.'],
        ['Роль', 'обстоятельство', 'сказуемое', 'сказуемое'],
        ['Изменяется', 'нет', 'по родам/числам', 'нет']
      ]
    },
    shortTestTitle: 'Наречие: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Он говорил (как?) весело — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 0},
      {kind: 'choose', question: 'Лицо было (каково?) весело — какая часть речи (согласуется с сущ. «лицо», ср.р.)?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'На улице было весело (нет подлежащего) — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 2},
      {kind: 'choose', question: 'Быстрее — простая или составная сравнительная степень?', options: ['простая', 'составная'], correct: 0},
      {kind: 'choose', question: 'Более быстро — простая или составная сравнительная степень?', options: ['простая', 'составная'], correct: 1},
      {kind: 'match', pairs: [{left: 'вчера', right: 'обстоятельственное'}, {left: 'очень', right: 'определительное'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: '«Море было спокойно» — «спокойно» это наречие?'},
          {speaker: 'b', text: 'Нет, это краткое прилагательное — оно согласуется с «морем», средний род.'},
          {speaker: 'a', text: 'А если сказать «Он говорил спокойно»?'},
          {speaker: 'b', text: 'Тогда наречие — относится к глаголу «говорил», отвечает на вопрос «как?».'}
        ]
      }
    ],
    largeTestTitle: 'Наречие: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Дети играли (как?) весело — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 0},
      {kind: 'choose', question: 'Море было спокойно (каково?) — какая часть речи (согласуется с «море», ср.р.)?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'В комнате было спокойно (без подлежащего) — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 2},
      {kind: 'choose', question: 'Быстрее всех — простая или составная превосходная степень?', options: ['простая', 'составная'], correct: 1},
      {kind: 'choose', question: 'Издалека — определительное или обстоятельственное наречие (место)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Очень — определительное или обстоятельственное наречие (мера/степень)?', options: ['определительное', 'обстоятельственное'], correct: 0},
      {kind: 'choose', question: 'Сгоряча — определительное или обстоятельственное наречие (причина)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Назло — определительное или обстоятельственное наречие (цель)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Вдвое — определительное или обстоятельственное наречие (мера)?', options: ['определительное', 'обстоятельственное'], correct: 0},
      {kind: 'choose', question: 'Ему было грустно (безличное предложение, нет подлежащего) — какая часть речи?', options: ['наречие', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'Он улыбался грустно (как?) — какая часть речи?', options: ['наречие', 'слово категории состояния'], correct: 0},
      {kind: 'match', pairs: [{left: 'небо ясно', right: 'краткое прилагательное'}, {left: 'ответила ясно', right: 'наречие'}]},
      {kind: 'match', pairs: [{left: 'вдвое', right: 'определительное'}, {left: 'назло', right: 'обстоятельственное'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога-разбора в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: '«Небо ясно» и «Она ответила ясно» — оба раза «ясно»?'},
          {speaker: 'b', text: 'Формы совпадают, но роли разные. Небо (каково?) ясно — краткое прилагательное, сказуемое при «небе».'},
          {speaker: 'a', text: 'А во втором случае?'},
          {speaker: 'b', text: 'Ответила (как?) ясно — наречие, относится к глаголу «ответила», не изменяется.'}
        ]
      }
    ]
  },

  // ── 9. function-words ───────────────────────────────────────────────────────────────────
  {
    slug: 'function-words',
    postTitle: 'Служебные части речи: как различить предлог, союз и частицу',
    richContent: doc(
      p(
        ['Предлог, союз и частица не называют предметов и не являются членами предложения, но выполняют важную грамматическую работу — связывают слова, части предложения или вносят смысловые оттенки. Настоящая сложность темы не в определениях, а в ', []],
        ['парах-ловушках', ['italic']],
        [': словах, которые звучат одинаково, но относятся к разным частям речи.', []]
      ),
      h3('Предлог vs самостоятельная часть речи'),
      p(
        ['Непроизводные предлоги (', []],
        ['в, на, с, из, к, у', ['italic']],
        [') существовали в языке изначально; производные образованы от других частей речи и легко спутать с ними: ', []],
        ['в течение часа', ['bold']],
        [' (предлог, = «на протяжении») — ', []],
        ['в течении реки', ['bold']],
        [' (существительное «течение» с предлогом «в», можно вставить слово: в спокойном течении).', []]
      ),
      bq(
        p(
          ['Несмотря на дождь', ['italic']],
          [' (предлог, = «вопреки») — ', []],
          ['не смотря по сторонам', ['italic']],
          [' (деепричастие, = «не глядя»). Проверка одна и та же для обеих пар: можно ли вставить слово или задать падежный вопрос к отдельной части — если да, перед вами самостоятельная часть речи, а не предлог.', []]
        )
      ),
      h3('Союз vs местоимение с частицей'),
      p(
        ['Сочинительные союзы (', []],
        ['и, а, но, или', ['italic']],
        [') связывают равноправные части, подчинительные (', []],
        ['потому что, чтобы, если, хотя', ['italic']],
        [') присоединяют придаточную часть к главной. Союз ', []],
        ['чтобы', ['bold']],
        [' отличают от местоимения с частицей ', []],
        ['что бы', ['bold']],
        [' по возможности переставить или убрать частицу ', []],
        ['бы', ['italic']],
        [': ', []],
        ['чтобы успеть', ['italic']],
        [' — переставить нельзя (союз); ', []],
        ['что бы почитать', ['italic']],
        [' — можно сказать «что почитать» (частица «бы» у местоимения).', []]
      ),
      h3('Частица'),
      p(
        ['Формообразующие частицы (', []],
        ['бы, да, пусть, пускай', ['italic']],
        [') участвуют в образовании форм наклонения. Смысловые частицы делятся по значению: отрицательные (', []],
        ['не, ни', ['italic']],
        ['), вопросительные (', []],
        ['ли, разве, неужели', ['italic']],
        ['), усилительные (', []],
        ['даже, ведь, уж', ['italic']],
        ['), указательные (', []],
        ['вот, вон', ['italic']],
        ['), ограничительные (', []],
        ['только, лишь', ['italic']],
        [').', []]
      ),
      table(
        ['Пример', 'Часть речи', 'Как проверить'],
        [
          ['в течение часа', 'предлог', '= на протяжении, слово вставить нельзя'],
          ['в течении реки', 'сущ. + предлог', 'можно вставить слово: в спокойном течении'],
          ['несмотря на дождь', 'предлог', '= вопреки'],
          ['не смотря по сторонам', 'деепричастие', '= не глядя']
        ]
      )
    ),
    cheatTitle: 'Предлог, союз, частица',
    cheatSections: [
      {
        heading: 'Предлог и пары-ловушки',
        bullets: [
          'Предлог — перед сущ./местоим./числит., выражает зависимость: в школу, о друге, несмотря на дождь.',
          'Производный предлог vs самостоятельная часть речи: в течение часа (предлог) — в течении реки (сущ. + предлог, можно вставить слово).',
          'Несмотря на (предлог, = вопреки) — не смотря по сторонам (деепричастие, = не глядя).'
        ]
      },
      {
        heading: 'Союз и частица',
        bullets: [
          'Союз связывает однородные члены/части сложного предложения: сочинительные (и, а, но), подчинительные (потому что, чтобы, если, когда).',
          'Чтобы/что бы: союз не разбивается (чтобы успеть), частицу бы можно убрать/переставить у местоимения (что бы почитать -> что почитать).',
          'Частица вносит смысловой оттенок: отрицательные (не, ни), вопросительные (ли, разве), усилительные (даже, ведь), указательные (вот, вон), ограничительные (только, лишь).'
        ]
      }
    ],
    cheatTable: {
      headers: ['Пример', 'Часть речи', 'Проверка'],
      colWidths: [155, 130, 210],
      rows: [
        ['в течение часа', 'предлог', '= на протяжении, слово не вставить'],
        ['в течении реки', 'сущ. + предлог', 'можно вставить слово'],
        ['несмотря на дождь', 'предлог', '= вопреки'],
        ['не смотря по сторонам', 'деепричастие', '= не глядя']
      ]
    },
    shortTestTitle: 'Предлог, союз, частица: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении предлог',
        tokens: [
          {text: 'Мы', correct: false},
          {text: 'гуляли', correct: false},
          {text: 'в', correct: true},
          {text: 'парке', correct: false},
          {text: 'допоздна', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении предлог (он состоит из двух слов)',
        tokens: [
          {text: 'Он', correct: false},
          {text: 'шёл', correct: false},
          {text: 'в', correct: true},
          {text: 'течение', correct: true},
          {text: 'часа', correct: false},
          {text: 'не', correct: false},
          {text: 'останавливаясь', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении союз (он состоит из двух слов)',
        tokens: [
          {text: 'Я', correct: false},
          {text: 'остался', correct: false},
          {text: 'дома', correct: false},
          {text: 'потому', correct: true},
          {text: 'что', correct: true},
          {text: 'шёл', correct: false},
          {text: 'дождь', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении частицы (их две)',
        tokens: [
          {text: 'Разве', correct: true},
          {text: 'ты', correct: false},
          {text: 'не', correct: true},
          {text: 'знаешь', correct: false},
          {text: 'ответа', correct: false}
        ]
      },
      {kind: 'match', pairs: [{left: 'чтобы успеть', right: 'союз'}, {left: 'что бы почитать', right: 'местоимение + частица'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: '«Чтобы успеть на поезд» — это союз?'},
          {speaker: 'b', text: 'Да, и его нельзя разбить: сказать «что бы успеть» вместо него нельзя.'},
          {speaker: 'a', text: 'А «Что бы такое почитать» — тоже союз?'},
          {speaker: 'b', text: 'Нет — там частицу «бы» можно убрать: «что почитать» звучит нормально, значит, это местоимение с частицей.'}
        ]
      }
    ],
    largeTestTitle: 'Предлог, союз, частица: большой тест на пары-ловушки',
    largeTestBlocks: [
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении предлог',
        tokens: [
          {text: 'Мы', correct: false},
          {text: 'гуляли', correct: false},
          {text: 'около', correct: true},
          {text: 'дома', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении предлог (он состоит из двух слов)',
        tokens: [
          {text: 'В', correct: true},
          {text: 'течение', correct: true},
          {text: 'месяца', correct: false},
          {text: 'дождя', correct: false},
          {text: 'не', correct: false},
          {text: 'было', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении только предлог (не существительное)',
        tokens: [
          {text: 'В', correct: true},
          {text: 'течении', correct: false},
          {text: 'реки', correct: false},
          {text: 'заметно', correct: false},
          {text: 'ускорение', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении предлог (он состоит из двух слов)',
        tokens: [
          {text: 'Несмотря', correct: true},
          {text: 'на', correct: true},
          {text: 'усталость', correct: false},
          {text: 'мы', correct: false},
          {text: 'дошли', correct: false},
          {text: 'до', correct: false},
          {text: 'конца', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении только частицу (не деепричастие)',
        tokens: [
          {text: 'Не', correct: true},
          {text: 'смотря', correct: false},
          {text: 'по', correct: false},
          {text: 'сторонам', correct: false},
          {text: 'он', correct: false},
          {text: 'быстро', correct: false},
          {text: 'шёл', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении союз (он состоит из двух слов)',
        tokens: [
          {text: 'Я', correct: false},
          {text: 'остался', correct: false},
          {text: 'дома', correct: false},
          {text: 'потому', correct: true},
          {text: 'что', correct: true},
          {text: 'шёл', correct: false},
          {text: 'дождь', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении только частицу бы (не местоимение)',
        tokens: [
          {text: 'Что', correct: false},
          {text: 'бы', correct: true},
          {text: 'такое', correct: false},
          {text: 'почитать', correct: false},
          {text: 'вечером', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении союз (не разбивается на части)',
        tokens: [
          {text: 'Чтобы', correct: true},
          {text: 'успеть', correct: false},
          {text: 'на', correct: false},
          {text: 'поезд', correct: false},
          {text: 'мы', correct: false},
          {text: 'поспешили', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении союз',
        tokens: [
          {text: 'Она', correct: false},
          {text: 'умна', correct: false},
          {text: 'а', correct: true},
          {text: 'он', correct: false},
          {text: 'находчив', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении частицы (их две)',
        tokens: [
          {text: 'Разве', correct: true},
          {text: 'ты', correct: false},
          {text: 'не', correct: true},
          {text: 'знаешь', correct: false},
          {text: 'ответа', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении частицу (формообразующая, повелительное наклонение)',
        tokens: [
          {text: 'Пусть', correct: true},
          {text: 'он', correct: false},
          {text: 'придёт', correct: false},
          {text: 'завтра', correct: false},
          {text: 'утром', correct: false}
        ]
      },
      {kind: 'match', pairs: [{left: 'в течение часа', right: 'предлог'}, {left: 'в течении реки', right: 'существительное с предлогом'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога-разбора в правильном порядке',
        speakers: {a: 'Ученик', b: 'Учитель'},
        lines: [
          {speaker: 'a', text: '«Несмотря на усталость» и «не смотря по сторонам» — в обеих есть «смотря», это одно и то же слово?'},
          {speaker: 'b', text: 'Нет, разные части речи. «Несмотря на» — производный предлог, заменяется на «вопреки».'},
          {speaker: 'a', text: 'А «не смотря по сторонам»?'},
          {speaker: 'b', text: 'Это деепричастие от «смотреть», заменяется на «не глядя».'}
        ]
      }
    ]
  },

  // ── 10. interjections (no table — genuinely not tabular) ──────────────────────────────
  {
    slug: 'interjections',
    postTitle: 'Междометие и звукоподражательные слова: пунктуация и различие',
    richContent: doc(
      p(
        ['Междометие — особая часть речи, которая не входит ни в самостоятельные, ни в служебные: она не называет предмет, признак или действие и не связывает слова, а прямо выражает чувства или побуждение к действию: ', []],
        ['ах! ой! увы! браво! эй!', ['italic']],
        [' Звукоподражательные слова стоят рядом, но, в отличие от междометий, ', []],
        ['не выражают эмоций', ['bold']],
        [', а имитируют звуки природы, животных, предметов: ', []],
        ['мяу, гав-гав, тик-так, ку-ку, бух.', ['italic']]
      ),
      bq(
        p(
          ['Отличить их по смыслу просто: междометие заменяется описанием чувства (', []],
          ['ах! = выражение удивления или боли', ['italic']],
          ['), звукоподражательное слово — описанием источника звука (', []],
          ['мяу = звук, который издаёт кошка', ['italic']],
          [').', []]
        )
      ),
      p(
        ['У обоих нет привычного лексического значения и грамматических категорий — рода, числа, падежа: они ', []],
        ['не изменяются', ['italic']],
        [' ни при каких условиях.', []]
      ),
      h3('Пунктуация'),
      p(
        ['На письме междометие или звукоподражательное слово обычно отделяется ', []],
        ['запятой', ['bold']],
        [' от остальной части предложения: ', []],
        ['Ах, как здесь красиво!', ['italic']],
        [' Если оно произносится с особой силой и выделяется интонационно, после него ставится ', []],
        ['восклицательный знак', ['bold']],
        [', а следующее слово пишется с заглавной буквы: ', []],
        ['Увы! Помочь уже нельзя.', ['italic']]
      ),
      h3('Ловушка омонимии'),
      p(
        ['Важно не путать междометие с омонимичными словами других частей речи. Слово ', []],
        ['ужас', ['bold']],
        [' может быть существительным (', []],
        ['Его охватил ужас', ['italic']],
        [') или междометием (', []],
        ['Ужас, как я устал!', ['italic']],
        [' — выражает эмоцию, не называет предмет).', []]
      ),
      ul([
        [['Слово называет предмет и является членом предложения — это самостоятельная часть речи.', []]],
        [['Слово только выражает эмоцию и не является членом предложения — это междометие.', []]]
      ])
    ),
    cheatTitle: 'Междометие и звукоподражательные слова',
    cheatSections: [
      {
        heading: 'Что это и чем отличаются',
        bullets: [
          'Междометие выражает эмоцию/побуждение, не называя её: ах, ой, увы, браво, эй.',
          'Звукоподражательное слово имитирует звук: мяу, гав-гав, тик-так, ку-ку, бух.',
          'Оба не изменяются, не имеют рода/числа/падежа, не являются членами предложения.'
        ]
      },
      {
        heading: 'Пунктуация и ловушка омонимии',
        bullets: [
          'Запятая отделяет междометие от остальной части предложения: Ах, как здесь красиво!',
          'Сильная интонация — восклицательный знак после междометия, дальше — заглавная буква: Увы! Помочь нельзя.',
          'Омонимия с другими частями речи: Его охватил ужас (сущ., член предложения) — Ужас, как я устал! (междометие, эмоция).',
          'Проверка: называет предмет и является членом предложения -> не междометие; выражает только эмоцию -> междометие.'
        ]
      }
    ],
    shortTestTitle: 'Междометие и звукоподражательные слова: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Ах, как здесь красиво! — что выражает «ах»?', options: ['эмоцию (междометие)', 'звук (звукоподражание)'], correct: 0},
      {kind: 'choose', question: 'Мяу, — сказал кот — что выражает «мяу»?', options: ['эмоцию (междометие)', 'звук (звукоподражание)'], correct: 1},
      {kind: 'choose', question: 'Нужна ли запятая: «Увы(,) помочь нельзя»?', options: ['да', 'нет'], correct: 0},
      {kind: 'choose', question: 'Его охватил ужас — «ужас» здесь существительное или междометие (называет предмет, член предложения)?', options: ['существительное', 'междометие'], correct: 0},
      {kind: 'choose', question: 'Ужас, как я устал! — «ужас» здесь существительное или междометие (выражает эмоцию)?', options: ['существительное', 'междометие'], correct: 1},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики в правильном порядке',
        speakers: {a: 'Аня', b: 'Петя'},
        lines: [
          {speaker: 'a', text: 'Ой, ты меня напугал!'},
          {speaker: 'b', text: 'Ха-ха, извини, не хотел.'},
          {speaker: 'a', text: 'Тише, а то мяу — кажется, кот проснулся.'},
          {speaker: 'b', text: 'Ах, точно, давай потише.'}
        ]
      }
    ],
    largeTestTitle: 'Междометие и звукоподражательные слова: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Ой, я забыл ключи! — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 0},
      {kind: 'choose', question: 'Гав-гав, залаяла собака — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 1},
      {kind: 'choose', question: 'Ку-ку раздалось из леса — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 1},
      {kind: 'choose', question: 'Браво! Как вы это сыграли — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 0},
      {kind: 'choose', question: 'Эй, постойте! — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 0},
      {kind: 'choose', question: 'После сильного «Увы!» следующее слово пишем с большой или маленькой буквы?', options: ['с большой', 'с маленькой'], correct: 0},
      {kind: 'choose', question: 'Батюшки, кто к нам пришёл! — «батюшки» здесь существительное или междометие?', options: ['существительное', 'междометие'], correct: 1},
      {kind: 'choose', question: 'Дети слушали батюшек в храме — «батюшек» здесь существительное или междометие?', options: ['существительное', 'междометие'], correct: 0},
      {kind: 'choose', question: 'Изменяется ли междометие по родам и числам?', options: ['да', 'нет'], correct: 1},
      {kind: 'choose', question: 'Является ли междометие членом предложения?', options: ['да', 'нет'], correct: 1},
      {kind: 'choose', question: 'Бух, — раздалось за дверью — междометие или звукоподражание (имитация звука падения)?', options: ['междометие', 'звукоподражание'], correct: 1},
      {kind: 'choose', question: 'Караул! Помогите скорее! — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 0},
      {kind: 'match', pairs: [{left: 'ах', right: 'междометие'}, {left: 'тик-так', right: 'звукоподражание'}]},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога в правильном порядке',
        speakers: {a: 'Соня', b: 'Дима'},
        lines: [
          {speaker: 'a', text: 'Ух ты, смотри какой закат!'},
          {speaker: 'b', text: 'Ага, а слышишь — ку-ку где-то рядом.'},
          {speaker: 'a', text: 'Ой, и правда! Давай найдём эту кукушку.'},
          {speaker: 'b', text: 'Хорошо, только тихо, а то спугнём.'}
        ]
      }
    ]
  }
]

// ───────────────────────── main ─────────────────────────
async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: TEACHER_EMAIL}})

  const report: {
    topic: string
    richDone: boolean
    imageStatus: 'already-v3' | 'refreshed' | 'skipped-error'
    coverUrl?: string
    cheatSheetUrl?: string
  }[] = []

  for (const topic of TOPICS) {
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id, title: topic.postTitle}})
    if (!post) {
      console.log(`! ${topic.slug}: пост "${topic.postTitle}" не найден (ожидался от тикета 02) — пропуск`)
      report.push({topic: topic.slug, richDone: false, imageStatus: 'skipped-error'})
      continue
    }

    const shortTest = await prisma.test.findFirst({where: {teacherId: teacher.id, title: topic.shortTestTitle, testCategories: {some: {categoryId: category.id}}}})
    const largeTest = await prisma.test.findFirst({where: {teacherId: teacher.id, title: topic.largeTestTitle, testCategories: {some: {categoryId: category.id}}}})
    if (!shortTest || !largeTest) {
      console.log(`! ${topic.slug}: тесты "${topic.shortTestTitle}"/"${topic.largeTestTitle}" не найдены — пропуск`)
      report.push({topic: topic.slug, richDone: false, imageStatus: 'skipped-error'})
      continue
    }

    const content = post.content as {blocks: {id: string; type: string; payload: Record<string, unknown>}[]} | null
    const blocks = content?.blocks ?? []
    const mediaIndex = blocks.findIndex((b) => b.type === 'MEDIA')
    const fileListIndex = blocks.findIndex((b) => b.type === 'FILE_LIST')
    const existingMediaUrl = mediaIndex >= 0 ? (blocks[mediaIndex].payload?.url as string | undefined) : undefined
    const existingFiles = fileListIndex >= 0 ? (blocks[fileListIndex].payload?.files as {url: string}[] | undefined) : undefined
    const existingCheatUrl = existingFiles?.[0]?.url

    const richDone = !!existingCheatUrl?.includes(RICH_CHEATSHEET_FOLDER)
    const imageDone = !!existingMediaUrl?.includes(RICH_COVER_FOLDER)

    console.log(`\n─── ${topic.slug} ─── rich:${richDone ? 'done' : 'pending'} image:${imageDone ? 'done' : 'pending'}`)

    let coverUrl = existingMediaUrl ?? ''
    let imageStatus: 'already-v3' | 'refreshed' | 'skipped-error' = imageDone ? 'already-v3' : 'skipped-error'

    if (imageDone) {
      console.log('  = обложка уже v3 — пропуск генерации')
    } else {
      try {
        const buffer = await generateCoverImage(COVER_PROMPTS[topic.slug])
        const jpeg = await compressCover(buffer)
        coverUrl = await uploadBuffer(jpeg, RICH_COVER_FOLDER, 'jpg', teacher.id, 'image/jpeg')
        imageStatus = 'refreshed'
        console.log(`  + обложка v3 (${jpeg.length}B, было ${buffer.length}B): ${coverUrl}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`  ! обложка не сгенерирована (${msg}) — оставляю старую (${coverUrl || 'нет обложки'})`)
      }
    }

    let cheatSheetUrl = existingCheatUrl ?? ''
    if (richDone) {
      console.log('  = TEXT/PDF/тесты уже v2 — пропуск')
    } else {
      const cheatBuffer = await buildCheatSheetPdfV2(topic.cheatTitle, topic.cheatSections, topic.cheatTable)
      cheatSheetUrl = await uploadBuffer(cheatBuffer, RICH_CHEATSHEET_FOLDER, 'pdf', teacher.id, 'application/pdf')
      console.log(`  + шпаргалка v2: ${cheatSheetUrl}`)

      const shortBlocks = topic.shortTestBlocks.map(buildTestBlock)
      const largeBlocks = topic.largeTestBlocks.map(buildTestBlock)
      await prisma.test.update({where: {id: shortTest.id}, data: {content: {description: shortTest.title, blocks: shortBlocks} as object}})
      await prisma.test.update({where: {id: largeTest.id}, data: {content: {description: largeTest.title, blocks: largeBlocks} as object}})
      console.log(`  + тесты перестроены: короткий ${shortBlocks.length} бл. / большой ${largeBlocks.length} бл.`)

      const newBlocks = [
        textBlock(topic.richContent),
        mediaBlock(coverUrl, `Обложка темы «${topic.cheatTitle}»`),
        testLinkBlock([
          {id: shortTest.id, title: shortTest.title},
          {id: largeTest.id, title: largeTest.title}
        ]),
        fileListBlock([{name: `${topic.cheatTitle} — шпаргалка.pdf`, size: cheatBuffer.length, mimeType: 'application/pdf', url: cheatSheetUrl}])
      ]
      await prisma.post.update({
        where: {id: post.id},
        data: {content: {blocks: newBlocks} as object, mediaUrls: extractMediaUrls(newBlocks)}
      })
      console.log(`  + пост обновлён: ${post.id}`)
    }

    // if rich part was already done on a previous run but the image just succeeded now, still
    // need to write the new cover url into the post's MEDIA block.
    if (richDone && imageStatus === 'refreshed') {
      const freshPost = await prisma.post.findUniqueOrThrow({where: {id: post.id}})
      const freshBlocks = (freshPost.content as {blocks: {id: string; type: string; payload: Record<string, unknown>}[]}).blocks
      const freshMediaIndex = freshBlocks.findIndex((b) => b.type === 'MEDIA')
      const updatedBlocks = freshBlocks.map((b, i) => (i === freshMediaIndex ? {...b, payload: {...b.payload, url: coverUrl}} : b))
      await prisma.post.update({where: {id: post.id}, data: {content: {blocks: updatedBlocks} as object, mediaUrls: extractMediaUrls(updatedBlocks)}})
      console.log('  + обложка v3 дописана в уже обновлённый пост')
    }

    report.push({topic: topic.slug, richDone: true, imageStatus, coverUrl, cheatSheetUrl})
  }

  console.log('\n─── ИТОГ ───')
  console.log(JSON.stringify(report, null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
