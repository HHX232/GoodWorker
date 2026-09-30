/**
 * Idempotent quality pass on the 8 "Орфография" topics from ticket 01
 * (prisma/seedRussianCourse01Orthography.ts) — user review after wave 1 went live asked for:
 *   1. richer, human-sounding TEXT prose (headings/bold/italic/blockquote/lists/tables —
 *      InfoTextEditor now supports Table/TableRow/TableHeader/TableCell, see
 *      src/features/BlockEditors/InfoTextEditor/InfoTextEditor.tsx)
 *   2. compressed cover images (were 1-1.5MB PNGs)
 *   3. FILL_TEXT tests rebuilt from "one gap = one block" spam into real multi-gap sentences
 *      (gap node shape confirmed via src/shared/ui/inputs/InputTaskGapComponent/InputGapNode.tsx
 *      + src/features/Tasks/TaskResult/scoreBlock.tsx: {type:'inputGap', attrs:{gapId, answer}})
 *   4. more block-type variety (MATCH_PAIRS / DIALOGUE payload shapes confirmed via
 *      src/features/Tasks/TaskObjects/{MatchPairsTask,DialogueTask}.tsx)
 *   5. cheat-sheet PDFs redesigned: colored header band, labeled sections, real 2-col table
 *      for grid-shaped topics, built manually with drawRectangle/drawLine/drawText (pdf-lib
 *      has no table primitive) instead of a flat bullet dump.
 *
 * No `src/` import at runtime (production image doesn't ship `src/`, bit prisma/migrateRussianCourseWave1.ts
 * and prisma/migrateRussianCourseWave1CoverRefresh.ts already) — block types are plain string
 * literals, S3 client rebuilt inline from env vars.
 *
 * Idempotency is per-resource, not per-topic, because bycom.by image generation turned out to
 * be unavailable this run (account balance is 0 — see report) and text/PDF work must not be
 * blocked by that: every post/test write tags itself with CONTENT_VERSION and is skipped only
 * once that specific resource already carries the marker.
 *   - TEXT block: payload gets an extra `richVersion` field alongside `content` (InfoTextEditor
 *     only reads `payload.content`, so the extra field is inert) — skip rewrite if already set.
 *   - MEDIA (cover): skip regeneration if the current url already contains COVER_FOLDER.
 *   - FILE_LIST (cheat sheet): skip regeneration if the current url already contains CHEATSHEET_FOLDER.
 *   - Test.content: gets an extra `contentVersion` field alongside `description`/`blocks` — skip
 *     rebuild if already set to CONTENT_VERSION.
 * A post is only written back to the DB if at least one of its pieces actually changed this run.
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1RichOrthography.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import {PDFDocument, PDFFont, PDFPage, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import sharp from 'sharp'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const CONTENT_VERSION = 'orthography-rich-v1'
const COVER_FOLDER = 'russian-course-images-v3'
const CHEATSHEET_FOLDER = 'russian-course-cheatsheets-v2'
// z-image-turbo is the cheap default per .autopilot/russian-course/interfaces.md §5 (0.03 BYN,
// vs flux-2-klein-4b's 0.06 used for the v2 cover-refresh backfill) — this run is explicitly a
// cost-conscious pass, so default to the cheapest model, not repeat the pricier one-off choice.
const BYCOM_MODEL = 'z-image-turbo'
// Compression lever: GET /v1/models has no `size`/`response_format` param for any image model
// (only `n`); empirically probing the generation endpoint with size=512x512 returned 400 with
// the real allowed_sizes list — smallest dimension bycom.by accepts is 576px, there is no smaller
// tier. 1024x576 is the biggest pixel-count cut available (589,824px vs 1,048,576px at 1024x1024,
// ~44% fewer pixels) and doubles as a natural post-cover banner aspect ratio.
const IMAGE_SIZE = '1024x576'

// ───────────────────────── S3 (inline, no src/ import) ─────────────────────────

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

// ───────────────────────── bycom.by image generation ─────────────────────────

async function generateCoverBycom(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BYCOM_API_KEY
  if (!apiKey) throw new Error('BYCOM_API_KEY is not set in .env')
  const res = await fetch('https://api.bycom.by/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: BYCOM_MODEL, prompt, n: 1, size: IMAGE_SIZE})
  })
  if (!res.ok) throw new Error(`bycom ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as {data?: {b64_json?: string}[]}
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error(`bycom response missing data[0].b64_json: ${JSON.stringify(json).slice(0, 300)}`)
  return Buffer.from(b64, 'base64')
}

// Requested IMAGE_SIZE (1024x576) is non-square, and bycom.by has no size/quality/format
// param besides `size` itself (see D01 in the Пунктуация script) — resize `fit: 'inside'`
// (not 'cover') so a genuinely 1024x576 PNG scales proportionally to ~768x432 instead of
// being cropped to a square. Re-encode as JPEG q78/mozjpeg, same as the other 3 scripts.
async function compressCover(pngBuffer: Buffer): Promise<Buffer> {
  return sharp(pngBuffer).resize(768, 768, {fit: 'inside'}).jpeg({quality: 78, mozjpeg: true}).toBuffer()
}

// ───────────────────────── TipTap rich-content builders (TEXT blocks) ─────────────────────────

type TTNode = Record<string, unknown>

function t(text: string, marks?: ('bold' | 'italic')[]): TTNode {
  return marks?.length ? {type: 'text', text, marks: marks.map((m) => ({type: m}))} : {type: 'text', text}
}
function para(...content: TTNode[]): TTNode {
  return {type: 'paragraph', content}
}
function heading(level: 2 | 3, text: string): TTNode {
  return {type: 'heading', attrs: {level}, content: [t(text)]}
}
function blockquote(text: string): TTNode {
  return {type: 'blockquote', content: [para(t(text, ['italic']))]}
}
function bulletList(items: TTNode[][]): TTNode {
  return {type: 'bulletList', content: items.map((runs) => ({type: 'listItem', content: [para(...runs)]}))}
}
function tableRow(cells: string[], header = false): TTNode {
  return {
    type: 'tableRow',
    content: cells.map((c) => ({type: header ? 'tableHeader' : 'tableCell', content: [para(t(c))]}))
  }
}
function table(headerCells: string[], rows: string[][]): TTNode {
  return {type: 'table', content: [tableRow(headerCells, true), ...rows.map((r) => tableRow(r))]}
}
function richDoc(...content: TTNode[]) {
  return {type: 'doc', content}
}

// ───────────────────────── FILL_TEXT (multi-gap, real sentences) ─────────────────────────

type FillPart = string | {gap: string}
let _uidCounter = 0
function uid() {
  return `rc01r-${Date.now()}-${++_uidCounter}`
}

// One sentence = an array of FillPart. A block groups a few related sentences into ONE
// coherent multi-gap exercise (the fix for "one gap = one block" spam).
function fillMultiBlock(sentences: FillPart[][]) {
  const content = sentences.map((parts) => {
    const runs: TTNode[] = []
    for (const part of parts) {
      if (typeof part === 'string') {
        if (part) runs.push({type: 'text', text: part})
      } else {
        runs.push({type: 'inputGap', attrs: {gapId: uid(), answer: part.gap}})
      }
    }
    return {type: 'paragraph', content: runs}
  })
  return {id: uid(), type: 'FILL_TEXT', payload: {content: {type: 'doc', content}}}
}

function chooseBlock(question: string, options: string[], correctIndex: number) {
  const opts = options.map((text) => ({id: uid(), text}))
  return {id: uid(), type: 'CHOOSE_OPTION', payload: {question, options: opts, correctId: opts[correctIndex].id}}
}

function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {id: uid(), type: 'MATCH_PAIRS', payload: {pairs: pairs.map((p) => ({id: uid(), ...p}))}}
}

function dialogueBlock(instruction: string, lines: {speaker: 'a' | 'b'; text: string}[], speakers: {a: string; b: string}) {
  return {
    id: uid(),
    type: 'DIALOGUE',
    payload: {instruction, speakers, lines: lines.map((l) => ({id: uid(), ...l}))}
  }
}

// ───────────────────────── PDF v2: header band + sections + table ─────────────────────────

const A4: [number, number] = [595.28, 841.89]
const ACCENT = rgb(0.55, 0.09, 0.24) // deep plum — Орфография block accent
const ACCENT_SOFT = rgb(0.96, 0.89, 0.92)
const INK = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.4, 0.4)

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

interface CheatSection {
  heading: string
  bullets: string[]
}
interface CheatTable {
  heading: string
  headerCells: [string, string]
  rows: [string, string][]
}

async function buildCheatSheetV2(title: string, sections: CheatSection[], tableSpec?: CheatTable): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const {regular, bold} = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const marginX = 46
  const maxWidth = A4[0] - marginX * 2
  const bandHeight = 96

  // header band
  page.drawRectangle({x: 0, y: A4[1] - bandHeight, width: A4[0], height: bandHeight, color: ACCENT})
  const titleLines = wrapText(title, bold, 21, maxWidth)
  let bandY = A4[1] - 38
  for (const line of titleLines) {
    page.drawText(line, {x: marginX, y: bandY, size: 21, font: bold, color: rgb(1, 1, 1)})
    bandY -= 26
  }
  page.drawText('Шпаргалка · Орфография', {x: marginX, y: A4[1] - bandHeight + 14, size: 10.5, font: regular, color: rgb(0.95, 0.85, 0.89)})

  let y = A4[1] - bandHeight - 34

  const drawSection = (page: PDFPage, y0: number, section: CheatSection): number => {
    let y = y0
    page.drawRectangle({x: marginX, y: y - 9, width: 9, height: 9, color: ACCENT})
    page.drawText(section.heading, {x: marginX + 16, y: y - 9, size: 13, font: bold, color: INK})
    y -= 24
    for (const line of section.bullets) {
      for (const wrapped of wrapText(`•  ${line}`, regular, 10.7, maxWidth - 6)) {
        page.drawText(wrapped, {x: marginX + 6, y, size: 10.7, font: regular, color: rgb(0.16, 0.16, 0.16)})
        y -= 15.5
      }
    }
    return y - 12
  }

  for (const section of sections) {
    y = drawSection(page, y, section)
  }

  if (tableSpec) {
    page.drawRectangle({x: marginX, y: y - 9, width: 9, height: 9, color: ACCENT})
    page.drawText(tableSpec.heading, {x: marginX + 16, y: y - 9, size: 13, font: bold, color: INK})
    y -= 26

    const col1W = maxWidth * 0.32
    const col2W = maxWidth * 0.68
    const cellPad = 6
    const rows: string[][] = [tableSpec.headerCells, ...tableSpec.rows]
    const top = y

    // pre-measure row heights
    const rowLines = rows.map((r) => {
      const l1 = wrapText(r[0], bold, 10, col1W - cellPad * 2)
      const l2 = wrapText(r[1], regular, 10, col2W - cellPad * 2)
      return {l1, l2, lines: Math.max(l1.length, l2.length, 1)}
    })
    const lineH = 13.5
    const rowH = rowLines.map((r) => r.lines * lineH + 8)
    const tableH = rowH.reduce((a, b) => a + b, 0)

    let rowY = top
    for (let i = 0; i < rows.length; i++) {
      const h = rowH[i]
      if (i === 0) {
        page.drawRectangle({x: marginX, y: rowY - h, width: col1W + col2W, height: h, color: ACCENT_SOFT})
      }
      const font1 = i === 0 ? bold : bold
      const font2 = i === 0 ? bold : regular
      let ty = rowY - 14
      for (const line of rowLines[i].l1) {
        page.drawText(line, {x: marginX + cellPad, y: ty, size: 10, font: font1, color: i === 0 ? ACCENT : INK})
        ty -= lineH
      }
      ty = rowY - 14
      for (const line of rowLines[i].l2) {
        page.drawText(line, {x: marginX + col1W + cellPad, y: ty, size: 10, font: font2, color: i === 0 ? ACCENT : rgb(0.16, 0.16, 0.16)})
        ty -= lineH
      }
      rowY -= h
    }
    // grid lines
    page.drawLine({start: {x: marginX, y: top}, end: {x: marginX + col1W + col2W, y: top}, thickness: 1, color: ACCENT})
    page.drawLine({start: {x: marginX, y: top - tableH}, end: {x: marginX + col1W + col2W, y: top - tableH}, thickness: 1, color: MUTED})
    page.drawLine({start: {x: marginX, y: top}, end: {x: marginX, y: top - tableH}, thickness: 1, color: MUTED})
    page.drawLine({start: {x: marginX + col1W, y: top}, end: {x: marginX + col1W, y: top - tableH}, thickness: 1, color: MUTED})
    page.drawLine({start: {x: marginX + col1W + col2W, y: top}, end: {x: marginX + col1W + col2W, y: top - tableH}, thickness: 1, color: MUTED})
    let sepY = top
    for (const h of rowH) {
      sepY -= h
      page.drawLine({start: {x: marginX, y: sepY}, end: {x: marginX + col1W + col2W, y: sepY}, thickness: 0.6, color: rgb(0.85, 0.85, 0.85)})
    }
    y = top - tableH - 18
  }

  page.drawText('GoodWorker · Курс «Русский язык»', {x: marginX, y: 30, size: 8.5, font: regular, color: MUTED})

  return Buffer.from(await pdfDoc.save())
}

// ───────────────────────── topic data ─────────────────────────

interface Topic {
  slug: string
  ruName: string
  richText: TTNode[]
  coverPrompt: string
  pdfSections: CheatSection[]
  pdfTable?: CheatTable
  shortTestBlocks: (
    | {kind: 'choose'; question: string; options: string[]; correct: number}
    | {kind: 'fillMulti'; sentences: FillPart[][]}
    | {kind: 'match'; pairs: {left: string; right: string}[]}
    | {kind: 'dialogue'; instruction: string; speakers: {a: string; b: string}; lines: {speaker: 'a' | 'b'; text: string}[]}
  )[]
  largeTestBlocks: Topic['shortTestBlocks']
}

const TOPICS: Topic[] = [
  {
    slug: 'spelling-words',
    ruName: 'Правописание слов',
    coverPrompt:
      'Bold advertising poster about tricky Russian spelling words, dictionary pages exploding into confetti of letters, vibrant contrasting colors, dynamic modern graphic design, no readable text',
    richText: [
      heading(2, 'Слова, которые придётся просто выучить'),
      para(
        t('Русская орфография в целом логична — но не вся. '),
        t('Часть слов', ['bold']),
        t(
          ' не подчиняется единому правилу: их написание нельзя вывести, подобрав однокоренное слово под ударением, потому что ни в одной форме спорная буква ударения не получает. Такие слова называют словарными.'
        )
      ),
      blockquote('Если слово нельзя проверить — единственная проверка это словарь и привычка часто его видеть в тексте.'),
      para(
        t('Хорошая новость: таких слов не бесконечно много, и большинство ошибок повторяются из года в год. '),
        t('Разберём их по трём группам', ['italic']),
        t(' — так их проще запомнить, чем сплошным списком.')
      ),
      heading(3, 'Двойные согласные'),
      bulletList([
        [t('аккуратный, аппетит', ['bold']), t(' — двойная согласная в первом слоге')],
        [t('интеллигенция, искусство, миллион', ['bold']), t(' — двойная согласная в середине слова')],
        [t('пассажир, режиссёр, экспресс, эффект', ['bold']), t(' — часто путают одну согласную с двумя')]
      ]),
      heading(3, 'Непроверяемая гласная'),
      bulletList([
        [t('балкон, вокзал, гостиница, коридор', ['bold']), t(' — гласная не проверяется ни в одной форме')],
        [t('календарь, панорама, тротуар, чемодан', ['bold']), t(' — то же самое: запоминаем целиком')]
      ]),
      heading(3, 'Редкие случаи'),
      para(
        t('Слово '),
        t('жюри', ['bold', 'italic']),
        t(
          ' пишется с Ю после Ж — это исключение из правила «жи-ши, ча-ща, чу-щу», которое действует почти всегда, но не здесь: слово заимствовано и сохранило иностранное написание. А в словах '
        ),
        t('здание, здоровье, здесь', ['bold']),
        t(' буква «з» — это часть корня, а не приставка, поэтому убрать её или заменить на «с» нельзя.')
      ),
      table(
        ['Слово', 'Что стоит запомнить'],
        [
          ['вестибюль', 'непроверяемая е, заимствовано из французского'],
          ['винегрет', 'е, не и — от vinaigrette'],
          ['дилетант', 'непроверяемая и'],
          ['привилегия', 'непроверяемая и и е сразу'],
          ['рюкзак', 'непроверяемая ю']
        ]
      )
    ],
    pdfSections: [
      {
        heading: 'Двойные согласные',
        bullets: [
          'аккуратный, аппетит, интеллигенция, искусство, миллион, пассажир, режиссёр, эффект, экспресс, комментарий.'
        ]
      },
      {
        heading: 'Непроверяемая гласная',
        bullets: ['балкон, вокзал, гостиница, календарь, коридор, панорама, тротуар, чемодан, лабиринт, конверт.']
      },
      {
        heading: 'Редкие случаи',
        bullets: [
          'жюри — ю после ж, исключение из правила «жи-ши».',
          'здание, здоровье, здесь — «з» это часть корня, не приставка.'
        ]
      }
    ],
    pdfTable: {
      heading: 'Заимствованные слова с непривычным звучанием',
      headerCells: ['Слово', 'Что проверять'],
      rows: [
        ['вестибюль', 'непроверяемая е'],
        ['винегрет', 'е, не и'],
        ['дилетант', 'непроверяемая и'],
        ['привилегия', 'и и е'],
        ['пьеса', 'ь и е']
      ]
    },
    shortTestBlocks: [
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['востибюль', 'вестибюль', 'вестибюл'], correct: 1},
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['пассажир', 'посажир', 'пассожир'], correct: 0},
      {
        kind: 'fillMulti',
        sentences: [
          ['Возле почты мы заметили к', {gap: 'о'}, 'нверт, лежавший прямо на снегу.'],
          ['Пещера напоминала узкий лаб', {gap: 'и'}, 'ринт с сотней поворотов.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['На вокзале стоял п', {gap: 'а'}, 'ссажир с огромным чемоданом.'],
          ['Идея показалась всем ор', {gap: 'и'}, 'гинальной и неожиданной.']
        ]
      },
      {
        kind: 'match',
        pairs: [
          {left: 'аккуратный', right: 'двойная согласная'},
          {left: 'коридор', right: 'непроверяемая гласная'},
          {left: 'жюри', right: 'редкое сочетание букв — исключение'},
          {left: 'здание', right: '«з» — часть корня, не приставка'}
        ]
      }
    ],
    largeTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Мы вышли в просторный к', {gap: 'о'}, 'ридор гостиницы и не сразу нашли свой номер.'],
          ['В самой г', {gap: 'о'}, 'стинице был крошечный б', {gap: 'а'}, 'лкон с видом на вокзал.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Летние к', {gap: 'а'}, 'никулы начались с поездки на приморский ф', {gap: 'е'}, 'стиваль музыки.'],
          ['Новый р', {gap: 'е'}, 'жиссёр театра расставил кресла прямо на тр', {gap: 'о'}, 'туаре.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Конкурс оценивало ж', {gap: 'ю'}, 'ри, заранее свериться с которым можно было по к', {gap: 'а'}, 'лендарю на сайте.'],
          ['Я забыл дома к', {gap: 'о'}, 'мпьютер, поэтому фотографировал п', {gap: 'а'}, 'нораму на телефон.']
        ]
      },
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['вокзал', 'вагзал', 'вокзалл'], correct: 0},
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['экспрес', 'экспресс', 'експресс'], correct: 1},
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['миллион', 'милион', 'миллиион'], correct: 0},
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['винегрет', 'винигрет', 'венигрет'], correct: 0},
      {
        kind: 'match',
        pairs: [
          {left: 'вестибюль', right: 'непроверяемая е (заимствование)'},
          {left: 'дилетант', right: 'непроверяемая и'},
          {left: 'привилегия', right: 'непроверяемые и и е'},
          {left: 'жюри', right: 'ю после ж — исключение'},
          {left: 'здоровье', right: '«з» — часть корня'}
        ]
      }
    ]
  },
  {
    slug: 'prefixes-suffixes',
    ruName: 'Приставки и суффиксы',
    coverPrompt:
      'Vibrant advertising poster illustrating word-building blocks snapping together like colorful LEGO pieces to form a word, prefix and suffix pieces highlighted in contrasting neon colors, bold modern design, no readable text',
    richText: [
      heading(2, 'Приставки на З/С и вечная путаница ПРЕ-/ПРИ-'),
      para(
        t('Эти две темы почти всегда идут в паре, хотя работают по-разному: одна — по звуку, другая — по смыслу. Разберём каждую отдельно, чтобы не смешивать правила.')
      ),
      heading(3, 'Приставки на З и С'),
      para(
        t('Приставки '),
        t('без-/бес-, из-/ис-, раз-/рас-, воз-/вос-, низ-/нис-, чрез-/чрес-, вз-/вс-', ['bold']),
        t(
          ' подчиняются фонетическому правилу: перед звонким согласным пишем З, перед глухим — С. Сравните: '
        ),
        t('безопасный', ['italic']),
        t(' (перед гласной — З) и '),
        t('бесполезный', ['italic']),
        t(' (перед глухим п — С).')
      ),
      blockquote('Приставка С- пишется всегда одинаково, независимо от следующего звука: сделать, сбежать, сгореть — правило «на з/с» тут ни при чём.'),
      para(
        t('Отдельно стоят слова '),
        t('здание, здоровье, здесь, ни зги', ['bold']),
        t(' — в них «з» исторически срослась с корнем, приставки здесь нет вовсе.')
      ),
      heading(3, 'ПРИ- и ПРЕ- — вопрос смысла, а не звука'),
      para(
        t('ПРИ- пишется, если в слове есть значение приближения ('),
        t('прибежать', ['italic']),
        t('), присоединения ('),
        t('пришить', ['italic']),
        t('), неполноты действия ('),
        t('приоткрыть', ['italic']),
        t(') или близости ('),
        t('пришкольный', ['italic']),
        t('). ПРЕ- — если значение близко к «очень» ('),
        t('превосходный', ['italic']),
        t(' = очень хороший) или к приставке ПЕРЕ- ('),
        t('преступить', ['italic']),
        t(' = переступить закон).')
      ),
      para(
        t('В части слов значение стёрлось, и написание нужно просто запомнить: '),
        t('пренебрегать, препятствие, президент, преследовать', ['bold']),
        t(' — но '),
        t('приключение, привет, приятный, приоритет', ['bold']),
        t('. Такие слова не выводятся по смыслу — их список стоит держать под рукой.')
      )
    ],
    pdfSections: [
      {
        heading: 'Приставки на З/С',
        bullets: [
          'Перед звонким — З (безопасный, разбить), перед глухим — С (бесполезный, распилить).',
          'С- пишется всегда одинаково: сделать, сбежать, сгореть.',
          'Здание, здоровье, здесь — «з» это часть корня, не приставка.'
        ]
      },
      {
        heading: 'ПРИ- (приближение / присоединение / неполнота / близость)',
        bullets: ['прибежать, пришить, приоткрыть, пришкольный, придумать.']
      },
      {
        heading: 'ПРЕ- («очень» или «пере-»)',
        bullets: ['превосходный (=очень хороший), преступить (=переступить).']
      },
      {
        heading: 'Исключения на запоминание',
        bullets: ['пренебрегать, препятствие, президент, преследовать; приключение, привет, приятный.']
      }
    ],
    shortTestBlocks: [
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['безопасный', 'бесопасный', 'безъопасный'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['расписание', 'разписание', 'расспиание'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['здоровье', 'сдоровье', 'зздоровье'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['бесшумный', 'безшумный', 'бессшумный'], correct: 0},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога в правильном порядке.',
        speakers: {a: 'Ученик', b: 'Репетитор'},
        lines: [
          {speaker: 'a', text: 'Почему в слове «прибежать» пишется И, а в «превосходный» — Е?'},
          {speaker: 'b', text: 'Смотри на смысл: «при-» — это приближение, «прибежать» значит подбежать поближе.'},
          {speaker: 'a', text: 'А «превосходный»?'},
          {speaker: 'b', text: 'Тут «пре-» заменяется на «очень» — превосходный, то есть очень хороший.'},
          {speaker: 'a', text: 'Тогда «пришкольный участок» — тоже при-, потому что он рядом со школой?'},
          {speaker: 'b', text: 'Именно, близость — ещё один повод для «при-».'}
        ]
      }
    ],
    largeTestBlocks: [
      {kind: 'choose', question: 'Пр_школьный участок — по смыслу «около школы». Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_рвать разговор — по смыслу «пере-рвать». Какая буква?', options: ['и', 'е'], correct: 1},
      {kind: 'choose', question: 'Пр_открыть окно — неполнота действия. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_красивый вид — по смыслу «очень красивый». Какая буква?', options: ['и', 'е'], correct: 1},
      {kind: 'choose', question: 'Пр_бежать домой — значение приближения. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_градить путь — по смыслу «перегородить». Какая буква?', options: ['и', 'е'], correct: 1},
      {kind: 'choose', question: 'Пр_думать историю — довести действие до конца. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_стально всмотреться — тщательность, близость. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_возносить заслуги — по смыслу «очень высоко». Какая буква?', options: ['и', 'е'], correct: 1},
      {kind: 'choose', question: 'Пр_шить пуговицу — значение присоединения. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_небрегать советами — словарное слово, запомнить. Какая буква?', options: ['и', 'е'], correct: 1},
      {kind: 'choose', question: 'Пр_ключение — словарное слово, запомнить. Какая буква?', options: ['и', 'е'], correct: 0},
      {kind: 'choose', question: 'Пр_зидент — словарное слово, запомнить. Какая буква?', options: ['и', 'е'], correct: 1},
      {
        kind: 'fillMulti',
        sentences: [
          ['Возле ', {gap: 'без'}, 'опасного спуска повесили табличку.'],
          ['После долгой ', {gap: 'рас'}, 'писки все разошлись по домам.']
        ]
      }
    ]
  },
  {
    slug: 'unstressed-vowels-root',
    ruName: 'Безударные гласные в корне',
    coverPrompt:
      'Eye-catching advertising poster about unstressed vowels hidden inside a word root, a magnifying glass spotlighting a glowing vowel letter shape, bold saturated colors, dynamic composition, no readable text',
    richText: [
      heading(2, 'Безударная гласная в корне: три типа и как их различать'),
      para(
        t(
          'Безударная гласная в корне — одна из самых частых ошибок на письме: на слух «о» и «а», «е» и «и» в безударной позиции звучат почти одинаково. Чтобы не ошибиться, нужно понять, к какому из трёх типов относится гласная.'
        )
      ),
      heading(3, 'Проверяемая'),
      para(
        t('Проверяется ударением: подбираем однокоренное слово или меняем форму так, чтобы спорная гласная оказалась под ударением. '),
        t('Вода', ['italic']),
        t(' → '),
        t('воды', ['bold']),
        t('; '),
        t('лесной', ['italic']),
        t(' → '),
        t('лес', ['bold']),
        t('.')
      ),
      heading(3, 'Непроверяемая (словарная)'),
      para(
        t('Проверочное слово подобрать невозможно — гласная ни в одной форме не бывает под ударением: '),
        t('собака, вагон, корзина, абрикос', ['bold']),
        t('. Их нужно запомнить или свериться со словарём.')
      ),
      heading(3, 'Чередующаяся — самый сложный тип'),
      para(
        t('В одном и том же корне гласная меняется по условию. Условием может быть ударение, следующая согласная, суффикс -а- после корня или значение слова.')
      ),
      blockquote('Чередование — не ошибка и не исключение, а правило со своим собственным условием. Найти условие важнее, чем запомнить конкретное слово.'),
      table(
        ['Корни', 'Условие'],
        [
          ['гар-/гор-, зар-/зор-', 'без ударения — о/е, под ударением — а'],
          ['раст-/ращ- — рос-', 'перед ст/щ — а, перед с — о (искл.: росток, Ростов, отрасль)'],
          ['лаг-/лож-', 'перед г — а, перед ж — о'],
          ['бир-/бер-, тир-/тер-, стил-/стел-', 'есть суффикс -а- после корня — и, нет — е'],
          ['мак-/мок-', '«погружать» — а, «пропускать жидкость» — о'],
          ['равн-/ровн-', '«одинаковый» — а, «гладкий, прямой» — о']
        ]
      )
    ],
    pdfSections: [
      {
        heading: 'Проверяемая и непроверяемая',
        bullets: [
          'Проверяемая: подбираем однокоренное слово под ударением. Вода -> воды, лесной -> лес.',
          'Непроверяемая (словарная): собака, вагон, корзина, абрикос — запоминаем или ищем в словаре.'
        ]
      }
    ],
    pdfTable: {
      heading: 'Чередующиеся корни — условие выбора буквы',
      headerCells: ['Корни', 'Условие'],
      rows: [
        ['гар-/гор-, зар-/зор-', 'без ударения о, под ударением а'],
        ['раст-/ращ- — рос-', 'перед ст/щ — а, перед с — о'],
        ['лаг-/лож-', 'перед г — а, перед ж — о'],
        ['бир-/бер-, тир-/тер-', 'суфф. -а- после корня — и, нет — е'],
        ['мак-/мок-', '«погружать» — а, «пропускать жидкость» — о']
      ]
    },
    shortTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Из крана текла холодная в', {gap: 'о'}, 'да, а тропинка за окном тянулась через л', {gap: 'е'}, 'сную полосу.'],
          ['Характер у него был сл', {gap: 'а'}, 'бый, а вот с', {gap: 'о'}, 'бака оказалась на удивление смелой.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [['На дачу мы взяли в', {gap: 'а'}, 'гон игрушек и плетёную к', {gap: 'о'}, 'рзину с яблоками.']]
      },
      {kind: 'choose', question: 'Выберите верный вариант (проверяем словом «воды»)', options: ['вада', 'вода'], correct: 1},
      {kind: 'choose', question: 'Выберите верный вариант (непроверяемое, словарное слово)', options: ['сабака', 'собака'], correct: 1},
      {
        kind: 'match',
        pairs: [
          {left: 'загорать / загар', right: 'без ударения о, под ударением а'},
          {left: 'растение / вырос', right: 'перед ст — а, перед с — о'},
          {left: 'полагать / положить', right: 'перед г — а, перед ж — о'},
          {left: 'собирать / соберу', right: 'суффикс -а- после корня даёт и'}
        ]
      }
    ],
    largeTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Всё лето мы старались хорошенько заг', {gap: 'о'}, 'реть, но настоящий заг', {gap: 'а'}, 'р появился только к августу.'],
          ['На рассвете небо окрашивала багровая з', {gap: 'а'}, 'ря, а к вечеру гасла последняя з', {gap: 'о'}, 'рька.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['В теплице выр', {gap: 'а'}, 'щенный рассадой куст быстро выр', {gap: 'о'}, 'с выше забора.'],
          ['Эта тема — отдельная отр', {gap: 'а'}, 'сль науки, хотя корень тот же, что у слова «расти».']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Учитель любил пол', {gap: 'а'}, 'гать, что задачу можно пол', {gap: 'о'}, 'жить в основу целого урока.'],
          ['Хотелось поскорее соб', {gap: 'е'}, 'ру чемодан, но я то и дело забывал что-нибудь соб', {gap: 'и'}, 'рать заново.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Перо обм', {gap: 'а'}, 'кнули в чернила, а плащ остался непром', {gap: 'о'}, 'каемым под дождём.'],
          ['Чтобы решить пример, вывели новое ур', {gap: 'а'}, 'внение и аккуратно подр', {gap: 'о'}, 'вняли края чертежа.']
        ]
      },
      {kind: 'choose', question: 'Выберите верный вариант (без ударения)', options: ['загарать', 'загорать'], correct: 1},
      {kind: 'choose', question: 'Выберите верный вариант (исключение, хотя перед ст ждём «а»)', options: ['расток', 'росток'], correct: 1},
      {
        kind: 'match',
        pairs: [
          {left: 'мак-/мок-', right: '«погружать» — а, «пропускать жидкость» — о'},
          {left: 'равн-/ровн-', right: '«одинаковый» — а, «гладкий» — о'},
          {left: 'бир-/бер-', right: 'суффикс -а- после корня — и'},
          {left: 'гар-/гор-', right: 'без ударения — о, под ударением — а'},
          {left: 'лаг-/лож-', right: 'перед г — а, перед ж — о'}
        ]
      }
    ]
  },
  {
    slug: 'hard-soft-signs',
    ruName: 'Ъ и Ь: разделительные и обозначающие мягкость',
    coverPrompt:
      'Bold advertising poster contrasting a hard sharp angular shape versus a soft rounded cushion shape, symbolizing hard and soft signs in Russian spelling, vivid contrasting color blocks, modern graphic poster design, no readable text',
    richText: [
      heading(2, 'Ъ и Ь: два знака без звука, но с большой ролью'),
      para(
        t(
          'Твёрдый знак (Ъ) и мягкий знак (Ь) сами по себе не обозначают звуков, но без них слово может читаться совсем иначе. Разберём, когда ставить какой.'
        )
      ),
      heading(3, 'Разделительный Ъ'),
      para(
        t('Ъ пишется после приставки, оканчивающейся на согласную, перед корнем, который начинается с Е, Ё, Ю или Я: '),
        t('въезд, съёмка, разъярённый', ['bold']),
        t('. Такое же правило действует после числительных '),
        t('двух-, трёх-, четырёх-', ['italic']),
        t(': двухъярусный.')
      ),
      heading(3, 'Разделительный Ь'),
      para(
        t('Пишется внутри корня или перед суффиксом (не после приставки!) перед Е, Ё, И, Ю, Я: '),
        t('вьюга, семья, пьеса, воробьи, курьер', ['bold']),
        t('.')
      ),
      blockquote('Главное отличие: Ъ стоит строго на стыке «приставка + корень», Ь — внутри корня или перед суффиксом. Приставки перед Ь не бывает.'),
      heading(3, 'Ь после шипящих'),
      para(
        t('Отдельное правило — для ж, ш, ч, щ. Пишем Ь у существительных женского рода 3-го склонения ('),
        t('ночь, мышь', ['italic']),
        t('), у глаголов на -ешь и в инфинитиве на -чь ('),
        t('пишешь, беречь', ['italic']),
        t('). '),
        t('Не пишем', ['bold']),
        t(' у существительных мужского рода ('),
        t('мяч', ['italic']),
        t(') и в родительном падеже множественного числа ('),
        t('много туч', ['italic']),
        t(').')
      )
    ],
    pdfSections: [
      {
        heading: 'Разделительный Ъ',
        bullets: [
          'После приставки на согласный перед Е, Ё, Ю, Я: подъезд, объявление, разъяснить, съёмка.',
          'После двух-/трёх-/четырёх- перед Е,Ё,Ю,Я: двухъярусный. Также объект, инъекция, конъюнктура.'
        ]
      },
      {
        heading: 'Разделительный Ь',
        bullets: ['Внутри корня/перед суффиксом, НЕ после приставки: вьюга, семья, пьеса, курьер.']
      },
      {
        heading: 'Ь после шипящих',
        bullets: [
          'Пишем: сущ. ж.р. 3 скл. (ночь), глаголы на -ешь/-чь (пишешь, беречь), наречия (настежь).',
          'Не пишем: сущ. м.р. (мяч), сущ. мн.ч. Р.п. (много туч), искл.-наречия (уж, замуж, невтерпёж).'
        ]
      }
    ],
    shortTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Рабочие уже заканчивали под', {gap: 'ъ'}, 'езд нового дома, когда режиссёр назначил с', {gap: 'ъ'}, 'ёмку на раннее утро.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          [
            'За окном поднялась настоящая в',
            {gap: 'ь'},
            'юга, и вся сем',
            {gap: 'ь'},
            'я осталась дома смотреть новогоднюю п',
            {gap: 'ь'},
            'есу.'
          ]
        ]
      },
      {kind: 'fillMulti', sentences: [['Курьер принёс пал', {gap: 'ь'}, 'то, забытое ещё в прошлый раз.']]},
      {
        kind: 'choose',
        question: 'Нужен ли Ь: «горяч.. суп» (краткое прилагательное, м.р.)?',
        options: ['нужен', 'не нужен'],
        correct: 1
      },
      {kind: 'choose', question: 'Нужен ли Ь: «отреж..!» (повелительное наклонение)?', options: ['нужен', 'не нужен'], correct: 0}
    ],
    largeTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Соседям пришлось раз', {gap: 'ъ'}, 'яснить новые правила, а в новом доме появился двух', {gap: 'ъ'}, 'ярусный балкон.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Курьер принёс медицинскую ин', {gap: 'ъ'}, 'екцию, пока учёные искали новый об', {gap: 'ъ'}, 'ект для исследования.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          [
            'Ночью на крыше кричали вороб',
            {gap: 'ь'},
            'и, а отец был раз',
            {gap: 'ъ'},
            'ярён испорченным из',
            {gap: 'ъ'},
            'яном в новой машине.'
          ]
        ]
      },
      {kind: 'choose', question: 'Нужен ли Ь: «много туч..» (Р.п. мн.ч. сущ.)?', options: ['нужен', 'не нужен'], correct: 1},
      {kind: 'choose', question: 'Нужен ли Ь: «стеречь» (инфинитив на -чь)?', options: ['нужен', 'не нужен'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['под(ъ)езд', 'подъезд', 'под-езд'], correct: 1}
    ]
  },
  {
    slug: 'ne-ni-spelling',
    ruName: 'НЕ и НИ с разными частями речи',
    coverPrompt:
      'Punchy advertising poster with a dramatic tug-of-war between two glowing particle shapes, one negating and one intensifying, vivid clashing colors, bold modern poster design about Russian grammar particles, no readable text',
    richText: [
      heading(2, 'НЕ и НИ: как не запутаться'),
      para(
        t(
          'Частицы НЕ и НИ путают даже опытных пишущих, потому что решение зависит сразу от нескольких факторов: части речи, наличия зависимых слов, противопоставления и даже ударения.'
        )
      ),
      heading(3, 'НЕ с существительными, прилагательными, наречиями на -о'),
      para(
        t('Пишется слитно, если слово не употребляется без НЕ ('),
        t('ненависть', ['italic']),
        t(') или заменяется синонимом ('),
        t('неправда', ['italic']),
        t(' = ложь). Раздельно — при явном противопоставлении с союзом А ('),
        t('не правда, а ложь', ['italic']),
        t(') и со словами '),
        t('вовсе не, далеко не, отнюдь не', ['bold']),
        t('.')
      ),
      heading(3, 'НЕ с глаголами, деепричастиями, причастиями'),
      para(
        t('С глаголами и деепричастиями — почти всегда раздельно ('),
        t('не знать, не читая', ['italic']),
        t('). С причастиями — слитно без зависимых слов ('),
        t('несделанная работа', ['italic']),
        t('), но раздельно с зависимым словом или в краткой форме ('),
        t('не сделанная вовремя работа', ['italic']),
        t(').')
      ),
      blockquote('НИ не отрицает сама по себе — она усиливает уже имеющееся отрицание или подчёркивает полноту утверждения: как я ни старался; кто бы ни пришёл.'),
      para(
        t('В отрицательных местоимениях и наречиях выбор определяется ударением: '),
        t('не́когда', ['bold']),
        t(' (под ударением — недостаток времени) и '),
        t('никогда́', ['bold']),
        t(' (без ударения — полное отрицание).')
      )
    ],
    pdfSections: [
      {
        heading: 'НЕ — слитно или раздельно',
        bullets: [
          'Слитно: слово не употребляется без НЕ (ненависть) или заменяется синонимом (неправда = ложь).',
          'Раздельно: есть противопоставление с А (не правда, а ложь) или усилители вовсе не, далеко не, отнюдь не.',
          'С глаголом/деепричастием — почти всегда раздельно: не знать, не читая.',
          'С причастием: слитно без завис. слов (несделанная), раздельно с завис. словом (не сделана вовремя).'
        ]
      },
      {
        heading: 'НИ — усиление и полнота',
        bullets: [
          'НИ усиливает отрицание или полноту утверждения: как ни старался; кто бы ни пришёл; ни облачка.',
          'Ударение решает: не́когда (недостаток времени) — никогда́ (полное отрицание).'
        ]
      }
    ],
    shortTestBlocks: [
      {kind: 'choose', question: 'Это была (не)правда, а ложь. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Ему было (не)весело на празднике (=грустно). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0},
      {kind: 'choose', question: 'На улице (не)было ни души. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Дорога оказалась (не)длинной, а короткой. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {
        kind: 'dialogue',
        instruction: 'Расставьте реплики диалога в правильном порядке.',
        speakers: {a: 'Ученик', b: 'Репетитор'},
        lines: [
          {speaker: 'a', text: 'Как я ни старался, задача не решалась.'},
          {speaker: 'b', text: 'Заметь: «ни» здесь усиливает отрицание, а не отрицает само по себе.'},
          {speaker: 'a', text: 'А если сказать «мне некогда было отдыхать»?'},
          {speaker: 'b', text: 'Здесь «не» под ударением и указывает на нехватку времени — «некогда».'},
          {speaker: 'a', text: 'Значит, «никогда» без ударения — это уже полное отрицание?'},
          {speaker: 'b', text: 'Верно: «никогда» значит «ни разу», а «некогда» — «нет времени».'}
        ]
      }
    ],
    largeTestBlocks: [
      {kind: 'choose', question: 'Как я (ни)старался, ничего не вышло. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'На небе (ни)облачка. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Куда (ни)глянь — всюду снег. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Это была вовсе (не)радостная встреча. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Задача (не)решена до сих пор (краткое причастие). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {
        kind: 'choose',
        question: '(Не)сделанная вовремя работа принесла проблемы (есть зависимое слово). Слитно или раздельно?',
        options: ['слитно', 'раздельно'],
        correct: 1
      },
      {
        kind: 'choose',
        question: 'Написанное, но (не)подписанное письмо лежало на столе (противопоставление). Слитно или раздельно?',
        options: ['слитно', 'раздельно'],
        correct: 1
      },
      {kind: 'choose', question: 'Кто бы (ни)пришёл, дверь всегда открыта. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Ему было (некуда/никуда) пойти. Как правильно?', options: ['некуда', 'никуда'], correct: 0},
      {kind: 'choose', question: 'Мне (некогда/никогда) было скучать (под ударением). Как правильно?', options: ['некогда', 'никогда'], correct: 0},
      {kind: 'choose', question: 'Я (не)годовал из-за несправедливости (без «не» не употребляется). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0},
      {kind: 'choose', question: 'Отнюдь (не)лёгкая задача досталась команде. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Дверь была (не)заперта (краткое причастие). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1}
    ]
  },
  {
    slug: 'n-nn-spelling',
    ruName: 'Н и НН в разных частях речи',
    coverPrompt:
      'Bold advertising poster comparing a single glowing dot versus a double glowing dot, symbolizing single versus double letter N in Russian spelling, vibrant high-contrast colors, sleek modern poster layout, no readable text',
    richText: [
      heading(2, 'Н и НН: алгоритм, который снимает почти все сомнения'),
      para(
        t(
          'Выбор между одной и двумя буквами Н — одна из самых формализуемых тем русской орфографии: есть чёткий алгоритм по шагам, а не набор случаев для зубрёжки.'
        )
      ),
      para(
        t('Шаг 1.', ['bold']),
        t(' Краткое причастие — всегда одна Н, без исключений: '),
        t('работа сделана', ['italic']),
        t('. '),
        t('Шаг 2.', ['bold']),
        t(' Краткое прилагательное — столько Н, сколько в полной форме: '),
        t('длинная → длинна', ['italic']),
        t('.')
      ),
      blockquote(
        'Шаг 3: для полного причастия или отглагольного прилагательного НН пишется, если есть хотя бы одно условие — приставка (кроме НЕ), зависимое слово, суффикс -ова-/-ева-/-ирова- или глагол совершенного вида. Нет ни одного условия — пишем одну Н.'
      ),
      table(
        ['Условие', 'Пример'],
        [
          ['Приставка (кроме не-)', 'скошенный'],
          ['Зависимое слово', 'жаренный на масле картофель'],
          ['Суффикс -ова-/-ева-/-ирова-', 'маринованный'],
          ['Глагол совершенного вида', 'решённая задача'],
          ['Ни одного условия', 'жареный, крашеный, стриженый']
        ]
      ),
      para(
        t('Есть традиционные исключения, которые запоминаются отдельно: '),
        t('раненый, названый брат, посажёный отец, прощёное воскресенье, приданое', ['bold']),
        t(' — одна Н несмотря на приставку или вид глагола. А слово '),
        t('ветреный', ['italic']),
        t(' — исключение с одной Н, но с приставкой ('),
        t('безветренный', ['italic']),
        t(') правило снова работает и пишется НН.')
      )
    ],
    pdfSections: [
      {
        heading: 'Шаги 1–2: краткие формы',
        bullets: [
          'Краткое причастие — всегда одна Н: работа сделана, дети избалованы.',
          'Краткое прилагательное — столько Н, сколько в полной форме: длинная -> длинна.'
        ]
      },
      {
        heading: 'Исключения на запоминание',
        bullets: [
          'Одна Н: раненый, названый брат, посажёный отец, прощёное воскресенье, приданое, ветреный.',
          'Суффиксы от сущ.: -ённ-/-енн- дают НН (соломенный); -ан-/-ян-/-ин- дают Н (кожаный). Искл.: деревянный, оловянный, стеклянный.'
        ]
      }
    ],
    pdfTable: {
      heading: 'Шаг 3: полное причастие / отглагольное прилагательное',
      headerCells: ['Условие для НН', 'Пример'],
      rows: [
        ['приставка (кроме не-)', 'скошенный'],
        ['зависимое слово', 'жаренный на масле'],
        ['суфф. -ова-/-ева-/-ирова-', 'маринованный'],
        ['глагол сов. вида', 'решённая'],
        ['ни одного условия — Н', 'жареный, крашеный']
      ]
    },
    shortTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Мама подала жаре', {gap: 'нн'}, 'ый на масле картофель, а бабушка приготовила простой жаре', {gap: 'н'}, 'ый.'],
          ['Учительница похвалила реше', {gap: 'нн'}, 'ую задачу и разлила детям клюкве', {gap: 'нн'}, 'ый морс.']
        ]
      },
      {kind: 'fillMulti', sentences: [['На полке стоял краше', {gap: 'н'}, 'ый пол и старый серебря', {gap: 'н'}, 'ый кубок на подставке.']]},
      {kind: 'choose', question: 'Выберите верный вариант («нет приставки и зависимого слова»)', options: ['варёный картофель', 'варённый картофель'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант (краткое причастие)', options: ['работа сделана', 'работа сделанна'], correct: 0},
      {
        kind: 'match',
        pairs: [
          {left: 'жареный картофель', right: 'нет условий — одна Н'},
          {left: 'жаренный на масле', right: 'есть зависимое слово — НН'},
          {left: 'маринованный', right: 'суффикс -ова- — НН'},
          {left: 'ветреный день', right: 'исключение — одна Н без приставки'}
        ]
      }
    ],
    largeTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Двор давно был асфальтирова', {gap: 'нн'}, 'ый, а ветре', {gap: 'н'}, 'ый день сдувал первый снег с крыш.'],
          ['К вечеру опустился безветре', {gap: 'нн'}, 'ый туман, и мы вынесли во двор деревя', {gap: 'нн'}, 'ый стол.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Подушка была набита гуси', {gap: 'н'}, 'ым пухом, а котёнок выглядел испуга', {gap: 'нн'}, 'ым.'],
          ['Забор покрасили только вчера — краше', {gap: 'нн'}, 'ый вчера забор ещё липнет к рукам.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['Девочка была настолько избалова', {gap: 'н'}, 'а, что даже длинная дорога казалась ей дли', {gap: 'нн'}, 'а.'],
          ['Он говорил пута', {gap: 'н'}, 'о, зато отвечал взволнова', {gap: 'нн'}, 'о.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [
          ['В доме была светлая гости', {gap: 'н'}, 'ая комната.'],
          ['На зва', {gap: 'н'}, 'ый вечер пришёл её назва', {gap: 'н'}, 'ый брат.']
        ]
      },
      {kind: 'choose', question: 'Выберите верный вариант', options: ['гостиная', 'гостинная'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант («приглашённый гость»)', options: ['званый вечер', 'званный вечер'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант (родственник по обычаю, не по крови)', options: ['названый брат', 'названный брат'], correct: 0},
      {
        kind: 'match',
        pairs: [
          {left: 'соломенный', right: 'суффикс -енн- от сущ. — НН'},
          {left: 'кожаный', right: 'суффикс -ан- от сущ. — Н'},
          {left: 'деревянный', right: 'исключение — НН'},
          {left: 'раненый', right: 'исключение — Н, хотя похоже на причастие'},
          {left: 'посажёный отец', right: 'исключение — Н, устойчивое выражение'}
        ]
      }
    ]
  },
  {
    slug: 'hyphenation-rules',
    ruName: 'Слитное, дефисное и раздельное написание',
    coverPrompt:
      'Dynamic advertising poster showing puzzle pieces in three states — fused together, linked by a small connector, and floating apart — representing solid, hyphenated and separate spelling, bold saturated colors, modern poster design, no readable text',
    richText: [
      heading(2, 'Слитно, через дефис или раздельно: правило своё для каждой части речи'),
      para(
        t(
          'Единой инструкции здесь нет — но есть закономерности для существительных, прилагательных, наречий и служебных слов. Разберём по частям речи.'
        )
      ),
      heading(3, 'Существительные'),
      para(
        t('Слитно — с соединительной гласной о/е ('),
        t('пароход', ['italic']),
        t(') или сложносокращённые слова ('),
        t('завуч', ['italic']),
        t('). Через дефис — два самостоятельных существительных без соединительной гласной ('),
        t('диван-кровать, генерал-майор', ['italic']),
        t(').')
      ),
      para(
        t('«Пол-»', ['bold']),
        t(' — слитно перед согласной, кроме л ('),
        t('полчаса', ['italic']),
        t('), и через дефис перед гласной, буквой л и заглавной буквой ('),
        t('пол-лимона, пол-Москвы', ['italic']),
        t(').')
      ),
      heading(3, 'Прилагательные и наречия'),
      para(
        t('Сложные прилагательные — слитно от подчинительного словосочетания ('),
        t('железнодорожный', ['italic']),
        t(' ← железная дорога), через дефис — от сочинительного сочетания или для оттенка ('),
        t('русско-английский, тёмно-синий', ['italic']),
        t(').')
      ),
      blockquote('Наречия чаще пишутся слитно, но через дефис — с приставкой по- и суффиксами -ому/-ему/-и (по-новому) и с частицами кое-/-то/-либо/-нибудь (кое-как).'),
      table(
        ['Часть речи', 'Правило'],
        [
          ['сложные сущ.', 'слитно с соединит. о/е; дефис — два самост. сущ.'],
          ['пол-', 'слитно перед согласной кроме л; дефис перед гласной/л/заглавной'],
          ['сложные прил.', 'слитно от подчинит. словосочетания; дефис — от сочинит. или оттенок'],
          ['наречия', 'дефис с по-...-ому/-ему/-и, с кое-/-то/-либо/-нибудь']
        ]
      ),
      para(
        t('Отдельно стоят производные предлоги ('),
        t('в течение, вследствие, ввиду', ['italic']),
        t(') — их отличают от существительного с предлогом по контексту: '),
        t('в течение часа', ['bold']),
        t(' (предлог), но '),
        t('в течении реки', ['bold']),
        t(' (существительное, можно вставить слово).')
      )
    ],
    pdfSections: [
      {
        heading: 'Существительные',
        bullets: [
          'Слитно с соединит. о/е: пароход. Дефис — два самост. сущ.: диван-кровать, генерал-майор.',
          'Пол-: слитно перед согласной кроме л (полчаса); дефис перед гласной/л/заглавной (пол-лимона, пол-Москвы).'
        ]
      },
      {
        heading: 'Прилагательные и наречия',
        bullets: [
          'Прилаг.: слитно от подчинит. словосочетания (железнодорожный); дефис — сочинит. или оттенок (тёмно-синий).',
          'Наречия: дефис с по-...-ому/-ему/-и (по-новому); с кое-/-то/-либо/-нибудь (кое-как).'
        ]
      },
      {
        heading: 'Предлоги и частицы',
        bullets: [
          'Производные предлоги (в течение, вследствие) отличаем от сущ. с предлогом по контексту.',
          'Частица -таки — дефис после глагола/наречия/частицы: всё-таки, опять-таки.'
        ]
      }
    ],
    shortTestBlocks: [
      {kind: 'choose', question: 'Выберите верный вариант', options: ['во-первых', 'вопервых', 'во первых'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['кое-как', 'коекак', 'кое как'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['всё-таки', 'всётаки', 'всё таки'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['в течение часа', 'втечение часа', 'в течении часа'], correct: 0},
      {
        kind: 'match',
        pairs: [
          {left: 'диван-кровать', right: 'дефис — два самостоятельных существительных'},
          {left: 'пароход', right: 'слитно — соединительная гласная о/е'},
          {left: 'во-первых', right: 'дефис — приставка в-/во- у порядкового числительного'},
          {left: 'пол-лимона', right: 'дефис — «пол-» перед гласной'}
        ]
      }
    ],
    largeTestBlocks: [
      {kind: 'choose', question: 'Выберите верный вариант', options: ['плащ-палатка', 'плащпалатка', 'плащ палатка'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['юго-запад', 'югозапад', 'юго запад'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['полчаса', 'пол-часа', 'пол часа'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['пол-Москвы', 'полМосквы', 'пол Москвы'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['тёмно-синий', 'тёмносиний', 'тёмно синий'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['железнодорожный', 'железно-дорожный', 'железно дорожный'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['русско-английский', 'русскоанглийский', 'русско английский'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['по-дружески', 'подружески', 'по дружески'], correct: 0},
      {
        kind: 'fillMulti',
        sentences: [
          ['Мы купили ', {gap: 'пол-апельсина'}, ' и ', {gap: 'пол-лимона'}, ' для чая.'],
          ['Соседи предложили встретиться ', {gap: 'несмотря'}, ' на дождь.']
        ]
      },
      {
        kind: 'match',
        pairs: [
          {left: 'генерал-майор', right: 'дефис — два самостоятельных существительных'},
          {left: 'горько-солёный', right: 'дефис — оттенок качества'},
          {left: 'в течение часа', right: 'производный предлог — раздельно'},
          {left: 'в течении реки', right: 'существительное с предлогом'},
          {left: 'опять-таки', right: 'частица -таки — всегда через дефис'}
        ]
      }
    ]
  },
  {
    slug: 'endings-spelling',
    ruName: 'Правописание падежных и личных окончаний',
    coverPrompt:
      'Vivid advertising poster of a rotating gear-like wheel of glowing word-ending fragments, symbolizing Russian noun and verb endings changing by case and person, bold vibrant colors, modern dynamic poster design, no readable text',
    richText: [
      heading(2, 'Падежные и личные окончания: проверяем по правилу, а не на слух'),
      para(
        t(
          'Безударные окончания существительных, прилагательных и глаголов часто пишутся не так, как слышатся. На слух «-е» и «-и» в конце слова легко перепутать — но у каждой части речи есть своя проверка.'
        )
      ),
      heading(3, 'Существительные — по склонению'),
      table(
        ['Склонение', 'Правило'],
        [
          ['1-е (Р./Д./П.п. ед.ч.)', '-е: к воде, о стране. На -ия — -и: о линии, к армии'],
          ['2-е (П.п.)', '-е: о столе. На -ий/-ие — -и: о планетарии, о здании'],
          ['3-е (ж.р. на Ь)', 'всегда -и, кроме И./В.п.: к ночи, о степи']
        ]
      ),
      heading(3, 'Прилагательные — по вопросу'),
      para(
        t('Окончание вопроса подсказывает окончание слова: '),
        t('в синем небе', ['italic']),
        t(' — '),
        t('каком?', ['bold']),
        t(' — небе, значит -ем; '),
        t('о лучшей подруге', ['italic']),
        t(' — '),
        t('какой?', ['bold']),
        t(' — значит -ей.')
      ),
      heading(3, 'Глаголы — по спряжению'),
      blockquote(
        'Чтобы определить спряжение, глагол ставят в неопределённую форму. II спряжение — глаголы на -ить (кроме брить, стелить) и 11 исключений: гнать, держать, смотреть, видеть, дышать, слышать, ненавидеть, вертеть, обидеть, терпеть, зависеть.'
      ),
      para(
        t('У глаголов II спряжения — окончания -ит/-ат(-ят): '),
        t('строишь, видит, дышат', ['italic']),
        t('. Все остальные глаголы — I спряжение, окончания -ет/-ут(-ют): '),
        t('читаешь, борются, стелет', ['italic']),
        t('.')
      )
    ],
    pdfSections: [
      {
        heading: 'Прилагательные',
        bullets: ['Окончание по вопросу: в синем небе — каком? — -ем; о лучшей подруге — какой? — -ей.']
      }
    ],
    pdfTable: {
      heading: 'Существительные и глаголы — сводная таблица',
      headerCells: ['Категория', 'Правило'],
      rows: [
        ['1 скл. (Р./Д./П.п.)', '-е: к воде. На -ия — -и: о линии'],
        ['2 скл. (П.п.)', '-е: о столе. На -ий/-ие — -и: о здании'],
        ['3 скл. (ж.р. на Ь)', 'всегда -и, кроме И./В.п.: о степи'],
        ['II спряжение', 'глаголы на -ить + 11 искл. — -ит/-ат(-ят)'],
        ['I спряжение', 'все остальные — -ет/-ут(-ют)']
      ]
    },
    shortTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['В школьном музее рассказывали о лини', {gap: 'и'}, ' фронта и показывали снимки в здани', {gap: 'и'}, ' штаба.'],
          ['Мы гуляли на площад', {gap: 'и'}, ' и любовались видом в син', {gap: 'ем'}, ' небе.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [['К лучш', {gap: 'ей'}, ' подруге мы заходили чаще, чем о берег', {gap: 'е'}, ' вспоминали в письмах.']]
      },
      {kind: 'choose', question: 'Выберите верное окончание: «в тетрад__»', options: ['-и', '-е'], correct: 0},
      {kind: 'choose', question: 'Выберите верное окончание: «о планетари__» (слово на -ий)', options: ['-и', '-е'], correct: 0},
      {kind: 'choose', question: 'Выберите верное окончание: «к берёз__» (1 склонение, Д.п.)', options: ['-е', '-и'], correct: 0}
    ],
    largeTestBlocks: [
      {
        kind: 'fillMulti',
        sentences: [
          ['Ты быстро пиш', {gap: 'ешь'}, ' сочинение, а он то и дело вид', {gap: 'ит'}, ' ошибки; они не раз бор', {gap: 'ются'}, ' с невнимательностью.']
        ]
      },
      {
        kind: 'fillMulti',
        sentences: [['Учитель терпеливо стел', {gap: 'ет'}, ' на парты карточки, а вы всегда дыш', {gap: 'ите'}, ' свежим воздухом на переменах.']]
      },
      {
        kind: 'fillMulti',
        sentences: [['Собаки гон', {gap: 'ят'}, ' стадо к реке, ты чита', {gap: 'ешь'}, ' вслух, а сосед терпеливо всё терп', {gap: 'ит'}, '.']]
      },
      {
        kind: 'fillMulti',
        sentences: [
          [
            'Мы читали объявление о постройк',
            {gap: 'е'},
            ' нового санатория в санатори',
            {gap: 'и'},
            ', а к дочер',
            {gap: 'и'},
            ' соседей заходили редко — письма лежали в тетрад',
            {gap: 'и'},
            '.'
          ]
        ]
      },
      {kind: 'choose', question: 'Выберите верное окончание: «в син__ небе»', options: ['-ем', '-ей'], correct: 0},
      {kind: 'choose', question: 'Выберите верное окончание: «на площад__»', options: ['-и', '-е'], correct: 0},
      {kind: 'choose', question: 'Выберите верное окончание: «о берег__»', options: ['-е', '-и'], correct: 0},
      {
        kind: 'match',
        pairs: [
          {left: '1 склонение, Р.п.', right: 'окончание -е: к воде'},
          {left: 'слово на -ия', right: 'окончание -и: об армии'},
          {left: '3 склонение', right: 'всегда -и: о степи'},
          {left: 'глагол на -ить', right: 'II спряжение — окончания -ит/-ат'},
          {left: 'глагол-исключение «смотреть»', right: 'II спряжение, хотя не на -ить'}
        ]
      }
    ]
  }
]

// ───────────────────────── main ─────────────────────────

interface PostBlockRow {
  id: string
  type: string
  payload: Record<string, unknown>
}

function findBlock(blocks: PostBlockRow[], type: string) {
  return blocks.find((b) => b.type === type)
}

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: TEACHER_EMAIL}})

  let textUpdated = 0,
    textSkipped = 0
  let coverUpdated = 0,
    coverSkipped = 0,
    coverFailed = 0
  let pdfUpdated = 0,
    pdfSkipped = 0
  let testsUpdated = 0,
    testsSkipped = 0
  let postsWritten = 0

  for (const topic of TOPICS) {
    console.log(`\n─── ${topic.slug} ───`)
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id}})
    if (!post) {
      console.log(`! пост для ${topic.slug} не найден — пропуск (ожидался результат тикета 01)`)
      continue
    }

    const content = post.content as {blocks: PostBlockRow[]} | null
    const blocks = content?.blocks ?? []
    let changed = false

    // ── TEXT ──
    const textBlock = findBlock(blocks, 'TEXT')
    if (textBlock) {
      if (textBlock.payload?.richVersion === CONTENT_VERSION) {
        textSkipped++
      } else {
        textBlock.payload = {content: richDoc(...topic.richText), richVersion: CONTENT_VERSION}
        changed = true
        textUpdated++
        console.log(`  + TEXT переписан (rich)`)
      }
    }

    // ── MEDIA (cover) ──
    const mediaBlock = findBlock(blocks, 'MEDIA')
    if (mediaBlock) {
      const existingUrl = mediaBlock.payload?.url as string | undefined
      if (existingUrl?.includes(COVER_FOLDER)) {
        coverSkipped++
      } else {
        try {
          const buffer = await generateCoverBycom(topic.coverPrompt)
          const jpeg = await compressCover(buffer)
          const coverUrl = await uploadBuffer(jpeg, COVER_FOLDER, 'jpg', teacher.id, 'image/jpeg')
          mediaBlock.payload = {...mediaBlock.payload, url: coverUrl}
          changed = true
          coverUpdated++
          console.log(`  + обложка v3 (${jpeg.length}B, было ${buffer.length}B): ${coverUrl}`)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.log(`  ! обложка не сгенерирована — оставлена старая: ${msg}`)
          coverFailed++
        }
      }
    }

    // ── FILE_LIST (cheat sheet) ──
    const fileListBlock = findBlock(blocks, 'FILE_LIST')
    if (fileListBlock) {
      const files = (fileListBlock.payload?.files as {url: string}[] | undefined) ?? []
      const existingUrl = files[0]?.url
      if (existingUrl?.includes(CHEATSHEET_FOLDER)) {
        pdfSkipped++
      } else {
        const buffer = await buildCheatSheetV2(`${topic.ruName} — шпаргалка`, topic.pdfSections, topic.pdfTable)
        const pdfUrl = await uploadBuffer(buffer, CHEATSHEET_FOLDER, 'pdf', teacher.id, 'application/pdf')
        fileListBlock.payload = {
          files: [{name: `${topic.ruName} — шпаргалка.pdf`, size: buffer.length, mimeType: 'application/pdf', url: pdfUrl}]
        }
        changed = true
        pdfUpdated++
        console.log(`  + шпаргалка v2: ${pdfUrl}`)
      }
    }

    if (changed) {
      const mediaUrls = blocks
        .filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string')
        .map((b) => b.payload.url as string)
      await prisma.post.update({where: {id: post.id}, data: {content: {blocks} as object, mediaUrls}})
      postsWritten++
      console.log(`  + пост обновлён: ${post.id}`)
    } else {
      console.log(`  = пост без изменений (все части уже версии ${CONTENT_VERSION})`)
    }

    // ── tests (via TEST_LINK ids on the post) ──
    const testLinkBlock = findBlock(blocks, 'TEST_LINK')
    const testRefs = (testLinkBlock?.payload?.tests as {id: string; title: string}[] | undefined) ?? []
    if (testRefs.length !== 2) {
      console.log(`  ! ожидалось 2 теста в TEST_LINK, найдено ${testRefs.length} — тесты пропущены`)
    } else {
      const [shortRef, largeRef] = testRefs
      for (const [ref, specs] of [
        [shortRef, topic.shortTestBlocks],
        [largeRef, topic.largeTestBlocks]
      ] as const) {
        const test = await prisma.test.findUnique({where: {id: ref.id}})
        if (!test) {
          console.log(`  ! тест ${ref.id} (${ref.title}) не найден — пропуск`)
          continue
        }
        const testContent = test.content as {description?: string; blocks?: unknown[]; contentVersion?: string} | null
        if (testContent?.contentVersion === CONTENT_VERSION) {
          testsSkipped++
          continue
        }
        const newBlocks = specs.map((spec) => {
          if (spec.kind === 'choose') return chooseBlock(spec.question, spec.options, spec.correct)
          if (spec.kind === 'fillMulti') return fillMultiBlock(spec.sentences)
          if (spec.kind === 'match') return matchPairsBlock(spec.pairs)
          return dialogueBlock(spec.instruction, spec.lines, spec.speakers)
        })
        await prisma.test.update({
          where: {id: test.id},
          data: {content: {description: testContent?.description ?? '', blocks: newBlocks, contentVersion: CONTENT_VERSION} as object}
        })
        testsUpdated++
        console.log(`  + тест «${ref.title}» переписан (${newBlocks.length} блоков)`)
      }
    }
  }

  console.log('\n─── ИТОГ ───')
  console.log(
    JSON.stringify(
      {
        textUpdated,
        textSkipped,
        coverUpdated,
        coverSkipped,
        coverFailed,
        pdfUpdated,
        pdfSkipped,
        testsUpdated,
        testsSkipped,
        postsWritten
      },
      null,
      2
    )
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
