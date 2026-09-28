/**
 * Idempotent migration: quality pass over the 10 "Синтаксис" topics from wave 1
 * (prisma/seedRussianCourse03Syntax.ts). Fixes four things the user flagged after
 * reviewing the live result:
 *   1. Post TEXT content was flat prose — rewritten with real TipTap formatting
 *      (headings/bold/italic/blockquote/lists/tables) where each topic benefits.
 *   2. Cover images were 1–1.5MB PNGs — regenerated at a smaller pixel count.
 *   3. FILL_TEXT tests were one TaskBlock per single gap (a pile of near-identical
 *      "Заполните пропуски" prompts) — consolidated into one multi-gap block per test.
 *   4. Tests leaned on 2–3 block types — added DIALOGUE/MATCH_PAIRS where a topic
 *      naturally fits (direct-speech ↔ DIALOGUE, introductory-words/one-part-sentence
 *      ↔ MATCH_PAIRS).
 *   5. Cheat-sheet PDFs were a plain bullet dump — redesigned with a colored header
 *      band, labeled sections and real hand-drawn tables (pdf-lib has no table
 *      primitive) for topics where a table is the clearest form.
 *
 * No `src/` import at runtime (production Docker image doesn't include `src/`, see
 * prisma/migrateRussianCourseWave1CoverRefresh.ts for the same fix after a
 * MODULE_NOT_FOUND on PostBlockType) — S3 client rebuilt inline from the same env
 * vars as src/shared/s3/s3Client.ts, block `type` fields are plain string literals.
 *
 * Idempotency: keyed off the post's FILE_LIST url already containing
 * CHEATSHEET_FOLDER ('russian-course-cheatsheets-v2') — the PDF/text rewrite needs no
 * paid external API and always succeeds, so it's a safe completion marker. Covers are
 * best-effort (try/catch, same pattern as CoverRefresh.ts): a topic is still marked
 * done even if the image call fails, so a second run doesn't re-spend credits on a
 * topic whose text/PDF already migrated — a late image backfill would need its own
 * follow-up script, same as D01 in interfaces.md §8 (Тикет 03).
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1RichSyntax.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {PDFDocument, PDFFont, PDFPage, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const IMAGE_MODEL = 'z-image-turbo' // cheapest tier (0.03 BYN) — see interfaces.md §5
// 1024x768 instead of the 1024x1024 baseline: 25% fewer pixels for a real, honest,
// parameter-only size reduction (bycom has no response_format/quality knob — see
// report). Also matches wave 1's original 4:3 cover aesthetic (velsvisual aspect_ratio=4:3).
const IMAGE_SIZE = '1024x768'
const COVER_FOLDER = 'russian-course-images-v3' // supersedes v1 and v2
const CHEATSHEET_FOLDER = 'russian-course-cheatsheets-v2' // supersedes v1; idempotency marker

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

// ───────────────────────── image generation (api.bycom.by, see interfaces.md §5) ─────────────────────────

async function generateCoverImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BYCOM_API_KEY
  if (!apiKey) throw new Error('BYCOM_API_KEY is not set in .env')

  const res = await fetch('https://api.bycom.by/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: IMAGE_MODEL, prompt, n: 1, size: IMAGE_SIZE})
  })
  if (!res.ok) throw new Error(`bycom ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as {data?: {b64_json?: string}[]}
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error(`bycom response missing data[0].b64_json: ${JSON.stringify(json).slice(0, 300)}`)
  return Buffer.from(b64, 'base64')
}

// ───────────────────────── TipTap doc builders (TEXT block) ─────────────────────────

type Run = string | {text: string; bold?: boolean; italic?: boolean}
type Node = Record<string, unknown>

function textRun(run: Run): Node {
  if (typeof run === 'string') return {type: 'text', text: run}
  const marks: Node[] = []
  if (run.bold) marks.push({type: 'bold'})
  if (run.italic) marks.push({type: 'italic'})
  return {type: 'text', text: run.text, ...(marks.length ? {marks} : {})}
}

function p(runs: Run[]): Node {
  return {type: 'paragraph', content: runs.map(textRun)}
}

function h(level: 2 | 3, text: string): Node {
  return {type: 'heading', attrs: {level}, content: [textRun(text)]}
}

function bq(paragraphs: Run[][]): Node {
  return {type: 'blockquote', content: paragraphs.map(p)}
}

function ul(items: Run[][]): Node {
  return {type: 'bulletList', content: items.map((runs) => ({type: 'listItem', content: [p(runs)]}))}
}

interface TableData {
  headers: string[]
  rows: string[][]
}

function tableCellNode(text: string, header: boolean): Node {
  return {type: header ? 'tableHeader' : 'tableCell', content: [p([text])]}
}

function tableNode(t: TableData): Node {
  const headerRow = {type: 'tableRow', content: t.headers.map((hd) => tableCellNode(hd, true))}
  const bodyRows = t.rows.map((row) => ({type: 'tableRow', content: row.map((c) => tableCellNode(c, false))}))
  return {type: 'table', content: [headerRow, ...bodyRows]}
}

// ───────────────────────── block builders (post + test) — plain string `type`, no enum import ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc03rich-${Date.now()}-${++_uidCounter}`
}

function textBlock(content: Node[]) {
  return {id: uid(), type: 'TEXT', payload: {content: {type: 'doc', content}}}
}

function mediaBlock(url: string, caption: string) {
  return {id: uid(), type: 'MEDIA', payload: {kind: 'image', url, caption}}
}

function fileListBlock(files: {name: string; size: number; mimeType: string; url: string}[]) {
  return {id: uid(), type: 'FILE_LIST', payload: {files}}
}

function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]): string[] {
  return blocks.filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string').map((b) => b.payload.url as string)
}

type FillPart = string | {gap: string}

// FILL_TEXT fix: ONE block, multiple paragraphs, each paragraph is a sentence with an
// inline `inputGap` — a single coherent exercise instead of one TaskBlock per gap
// (confirmed shape by reading scoreBlock.tsx's extractGaps + FillTextEditor.tsx: gaps
// are `{type:'inputGap', attrs:{gapId, answer}}` atoms anywhere in the doc tree).
function fillTextBlockMulti(paragraphs: FillPart[][]) {
  return {
    id: uid(),
    type: 'FILL_TEXT',
    payload: {
      content: {
        type: 'doc',
        content: paragraphs.map((parts) => {
          const content: Node[] = []
          for (const part of parts) {
            if (typeof part === 'string') {
              if (part) content.push({type: 'text', text: part})
            } else {
              content.push({type: 'inputGap', attrs: {gapId: uid(), answer: part.gap}})
            }
          }
          return {type: 'paragraph', content}
        })
      }
    }
  }
}

function chooseBlock(question: string, options: string[], correctIndex: number) {
  const opts = options.map((text) => ({id: uid(), text}))
  return {id: uid(), type: 'CHOOSE_OPTION', payload: {question, options: opts, correctId: opts[correctIndex].id}}
}

function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {id: uid(), type: 'MATCH_PAIRS', payload: {pairs: pairs.map((pr) => ({id: uid(), left: pr.left, right: pr.right}))}}
}

// DialoguePayload: {instruction, speakers:{a,b}, lines:[{id,speaker,text}]} — scored by
// exact order of `lines` (scoreBlock.tsx: `p.lines.map(l=>l.id).join() === answer.value.join()`),
// confirmed by reading DialogueTask.tsx + TaskPayload.type.ts before use.
function dialogueBlock(instruction: string, speakers: {a: string; b: string}, lines: {speaker: 'a' | 'b'; text: string}[]) {
  return {
    id: uid(),
    type: 'DIALOGUE',
    payload: {instruction, speakers, lines: lines.map((l) => ({id: uid(), speaker: l.speaker, text: l.text}))}
  }
}

// ───────────────────────── PDF redesign: header band + sections + hand-drawn tables ─────────────────────────

const A4: [number, number] = [595.28, 841.89]
const ACCENT = rgb(0.13, 0.29, 0.82) // single accent, used consistently (header band, section markers, table header row)
const ACCENT_SOFT = rgb(0.91, 0.94, 1)
const INK = rgb(0.08, 0.08, 0.09)
const MUTED = rgb(0.42, 0.44, 0.48)

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

function drawTableGrid(
  page: PDFPage,
  opts: {x: number; y: number; width: number; table: TableData; font: PDFFont; bold: PDFFont}
): number {
  const {x, table, font, bold} = opts
  const width = opts.width
  let y = opts.y
  const colCount = table.headers.length
  const colWidth = width / colCount
  const fontSize = 9.5
  const rowPad = 6

  function rowHeight(cells: string[], f: PDFFont): number {
    let maxLines = 1
    for (const cell of cells) {
      maxLines = Math.max(maxLines, wrapText(cell, f, fontSize, colWidth - 10).length)
    }
    return maxLines * 12 + rowPad * 2
  }

  function drawRow(cells: string[], isHeader: boolean) {
    const rh = rowHeight(cells, isHeader ? bold : font)
    if (isHeader) {
      page.drawRectangle({x, y: y - rh, width, height: rh, color: ACCENT_SOFT})
    }
    for (let i = 0; i <= colCount; i++) {
      page.drawLine({start: {x: x + i * colWidth, y}, end: {x: x + i * colWidth, y: y - rh}, thickness: 0.6, color: MUTED})
    }
    for (const [i, cell] of cells.entries()) {
      const cellFont = isHeader ? bold : font
      const lines = wrapText(cell, cellFont, fontSize, colWidth - 10)
      let ty = y - rowPad - 8
      for (const line of lines) {
        page.drawText(line, {x: x + i * colWidth + 5, y: ty, size: fontSize, font: cellFont, color: INK})
        ty -= 12
      }
    }
    y -= rh
    page.drawLine({start: {x, y}, end: {x: x + width, y}, thickness: 0.6, color: MUTED})
  }

  page.drawLine({start: {x, y}, end: {x: x + width, y}, thickness: 0.6, color: MUTED})
  drawRow(table.headers, true)
  for (const row of table.rows) drawRow(row, false)
  return y
}

interface PdfSection {
  heading: string
  bullets?: string[]
  table?: TableData
}

async function buildCheatSheetPdfV2(title: string, sections: PdfSection[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const {regular, bold} = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const [pageW, pageH] = A4
  const marginX = 46
  const maxWidth = pageW - marginX * 2

  // header band
  const bandH = 88
  page.drawRectangle({x: 0, y: pageH - bandH, width: pageW, height: bandH, color: ACCENT})
  page.drawText('ШПАРГАЛКА · РУССКИЙ ЯЗЫК · СИНТАКСИС', {x: marginX, y: pageH - 26, size: 9, font: regular, color: rgb(0.85, 0.89, 1)})
  const titleLines = wrapText(title, bold, 19, maxWidth)
  titleLines.forEach((line, i) => {
    page.drawText(line, {x: marginX, y: pageH - 48 - i * 23, size: 19, font: bold, color: rgb(1, 1, 1)})
  })

  let y = pageH - bandH - 30

  for (const section of sections) {
    if (y < 90) break // one-page budget — see report on any topic that would overflow
    page.drawRectangle({x: marginX, y: y - 2, width: 4, height: 13, color: ACCENT})
    page.drawText(section.heading, {x: marginX + 10, y, size: 12.5, font: bold, color: INK})
    y -= 20

    if (section.bullets) {
      for (const line of section.bullets) {
        const wrapped = wrapText(`•  ${line}`, regular, 10.5, maxWidth - 10)
        for (const w of wrapped) {
          page.drawText(w, {x: marginX + 10, y, size: 10.5, font: regular, color: INK})
          y -= 14.5
        }
        y -= 3
      }
    }

    if (section.table) {
      y -= 4
      y = drawTableGrid(page, {x: marginX, y, width: maxWidth, table: section.table, font: regular, bold})
    }

    y -= 14
  }

  return Buffer.from(await pdfDoc.save())
}

// ───────────────────────── topic content ─────────────────────────

interface TestUpdate {
  title: string
  blocks: Node[]
}

interface Topic {
  slug: string
  ruName: string
  postTitle: string
  coverPrompt: string
  richDoc: Node[]
  pdfSections: PdfSection[]
  testUpdates?: TestUpdate[]
}

const TOPICS: Topic[] = [
  {
    slug: 'simple-sentence',
    ruName: 'Простое предложение',
    postTitle: 'Простое предложение: главные и второстепенные члены',
    coverPrompt:
      'Minimalist editorial photo of wooden alphabet blocks arranged in a neat row on a desk, soft natural light, calm study atmosphere, no readable text',
    richDoc: [
      p([
        'Любое простое предложение держится на одном стержне — ',
        {text: 'грамматической основе', bold: true},
        ': подлежащем и сказуемом. Если один из них выпадает, предложение не разваливается — оно превращается в односоставное, но об этом отдельный разговор. Подлежащее называет предмет речи (',
        {text: 'кто? что?', italic: true},
        '), сказуемое говорит, что об этом предмете известно (',
        {text: 'что делает? каков он? что он такое?', italic: true},
        ').'
      ]),
      h(3, 'Три лица сказуемого'),
      p(['Сказуемое — не всегда один глагол. У него три рабочих формы, и различать их полезно не только для тестов, а чтобы вообще видеть структуру фразы:']),
      tableNode({
        headers: ['Тип', 'Из чего состоит', 'Пример'],
        rows: [
          ['ПГС — простое глагольное', 'один глагол в любом наклонении', 'Дождь идёт весь день.'],
          ['СГС — составное глагольное', 'вспомогательный глагол + инфинитив', 'Он начал готовиться к экзамену.'],
          ['СИС — составное именное', 'глагол-связка + именная часть', 'Погода была ясной. Она врач.']
        ]
      }),
      p([
        {text: 'Ловушка: ', bold: true},
        'в настоящем времени связка ',
        {text: 'быть', italic: true},
        ' обычно пропадает («Она врач», а не «Она есть врач»), и предложение легко принять за односоставное или за предложение без сказуемого вообще. Это заблуждение — связка просто нулевая, а не отсутствующая.'
      ]),
      bq([
        [
          {text: 'Правило проверки: ', bold: true},
          'если можно подставить «есть» без потери смысла — перед вами именно сказуемое с нулевой связкой, а не подлежащее-в-одиночестве.'
        ]
      ]),
      h(3, 'Второстепенные члены'),
      ul([
        [{text: 'Дополнение', bold: true}, ' — вопросы косвенных падежей (кого? чему? кем?): ', {text: 'читаю книгу', italic: true}, '.'],
        [{text: 'Определение', bold: true}, ' — вопросы какой? чей?: ', {text: 'интересная книга', italic: true}, '.'],
        [{text: 'Обстоятельство', bold: true}, ' — вопросы где? когда? как? почему? зачем?: ', {text: 'читаю вечером', italic: true}, '.']
      ])
    ],
    pdfSections: [
      {
        heading: 'Грамматическая основа',
        bullets: [
          'Подлежащее (кто? что?) + сказуемое (что делает? каков?).',
          'В наст. времени связка «быть» в СИС часто опущена: Она врач = Она есть врач.'
        ]
      },
      {
        heading: 'Три типа сказуемого',
        table: {
          headers: ['Тип', 'Состав', 'Пример'],
          rows: [
            ['ПГС', 'один глагол', 'идёт, читает'],
            ['СГС', 'вспом. глагол + инфинитив', 'начал готовиться'],
            ['СИС', 'связка + именная часть', 'была ясной, она врач']
          ]
        }
      },
      {
        heading: 'Второстепенные члены',
        bullets: [
          'Дополнение — косвенные падежи (кого? чему?): читаю книгу.',
          'Определение — какой? чей?: интересная книга.',
          'Обстоятельство — где? когда? как? почему? зачем?: читаю вечером.'
        ]
      }
    ]
  },
  {
    slug: 'complex-sentence',
    ruName: 'Сложноподчинённое предложение: виды придаточных',
    postTitle: 'Сложноподчинённое предложение: виды придаточных',
    coverPrompt:
      'Abstract editorial illustration of branching tree-like ink lines on textured paper, representing connected clauses, muted tones, no readable text',
    richDoc: [
      p([
        'В сложноподчинённом предложении (СПП) одна часть — главная — задаёт вопрос, а другая — придаточная — на него отвечает. Это и есть ключ ко всей теме: ',
        {text: 'не запоминайте союзы по отдельности', bold: true},
        ', а тренируйтесь задавать вопрос от главной части. Тип придаточного определяется именно этим вопросом.'
      ]),
      bq([[{text: 'Алгоритм: ', bold: true}, 'найдите главную часть -> задайте от неё вопрос к придаточной -> вопрос и подскажет тип.']]),
      h(3, 'Вопрос -> тип придаточного'),
      tableNode({
        headers: ['Тип', 'Вопрос', 'Союз / союзное слово', 'Пример'],
        rows: [
          ['определительное', 'какой?', 'который', 'Дом, который стоит на холме, виден издалека.'],
          ['изъяснительное', 'косвенные падежи', 'что, чтобы, будто', 'Я знаю, что он прав.'],
          ['места', 'где? куда? откуда?', 'где, куда, откуда', 'Иди, куда глаза глядят.'],
          ['времени', 'когда? как долго?', 'когда, пока', 'Мы вышли, когда стемнело.'],
          ['причины', 'почему?', 'потому что, так как', 'Он опоздал, потому что проспал.'],
          ['цели', 'зачем?', 'чтобы', 'Он учился, чтобы сдать экзамен.'],
          ['условия', 'при каком условии?', 'если, раз', 'Если пойдёт дождь, мы останемся дома.'],
          ['уступки', 'несмотря на что?', 'хотя', 'Хотя было холодно, мы пошли гулять.'],
          ['сравнения', 'как? подобно чему?', 'как, будто, словно', 'Он говорил так, будто всё знал заранее.'],
          ['меры и степени', 'в какой мере?', 'так что, насколько', 'Мороз был так силён, что деревья трещали.']
        ]
      }),
      p([
        'Изъяснительное придаточное — единственный тип, который не отвечает на «обстоятельственный» вопрос вроде ',
        {text: 'где/когда/почему', italic: true},
        '. Оно раскрывает ',
        {text: 'содержание', bold: true},
        ' речи, мысли или чувства и относится к глаголу вроде ',
        {text: 'знать, сказать, чувствовать, услышать', italic: true},
        '.'
      ])
    ],
    pdfSections: [
      {
        heading: 'Как определить тип',
        bullets: ['СПП = главная часть + придаточная, связаны союзом/союзным словом.', 'Вопрос от главной части к придаточной определяет тип — это и есть весь метод.']
      },
      {
        heading: 'Таблица придаточных',
        table: {
          headers: ['Тип', 'Вопрос', 'Союз', 'Пример'],
          rows: [
            ['определительное', 'какой?', 'который', 'Дом, который стоит...'],
            ['изъяснительное', 'косв. падежи', 'что, чтобы', 'Я знаю, что он прав.'],
            ['места', 'где? куда?', 'где, куда, откуда', 'Иди, куда глаза глядят.'],
            ['времени', 'когда?', 'когда, пока', 'Вышли, когда стемнело.'],
            ['причины', 'почему?', 'потому что', 'Опоздал, потому что проспал.'],
            ['цели', 'зачем?', 'чтобы', 'Учился, чтобы сдать.'],
            ['условия', 'при условии?', 'если, раз', 'Если дождь — останемся.'],
            ['уступки', 'несмотря на что?', 'хотя', 'Хотя холодно — пошли гулять.'],
            ['сравнения', 'подобно чему?', 'как, будто', 'Говорил, будто знал.'],
            ['меры/степени', 'в какой мере?', 'так что', 'Так силён, что трещали.']
          ]
        }
      }
    ]
  },
  {
    slug: 'phrase-connection',
    ruName: 'Словосочетание: виды связи',
    postTitle: 'Словосочетание: согласование, управление, примыкание',
    coverPrompt: 'Macro photo of two wooden puzzle pieces interlocking on a table, warm light, minimalist composition, no readable text',
    richDoc: [
      p([
        'Словосочетание — это главное слово плюс зависимое, связанные и по смыслу, и грамматически. ',
        {text: 'Грамматическая основа предложения словосочетанием не считается', bold: true},
        ' — подлежащее и сказуемое равноправны, а в словосочетании один член всегда подчинён другому.'
      ]),
      p(['Определить вид связи проще всего одним и тем же приёмом: посмотреть, что происходит с зависимым словом, если менять форму главного.']),
      tableNode({
        headers: ['Вид связи', 'Что происходит с зависимым словом', 'Пример'],
        rows: [
          ['согласование', 'меняется вместе с главным (род/число/падеж)', 'красивый дом -> красивого дома'],
          ['управление', 'стоит в одном и том же падеже независимо от формы главного', 'читать книгу, читаю книгу, читал книгу'],
          ['примыкание', 'вообще не изменяется — слово неизменяемое', 'говорить громко, желание учиться, её книга']
        ]
      }),
      bq([
        [
          {text: 'Примыкают', bold: true},
          ' только неизменяемые части речи: наречие, деепричастие, инфинитив, притяжательные ',
          {text: 'его/её/их', italic: true},
          '. Если слово в принципе можно просклонять или проспрягать — это не примыкание.'
        ]
      ])
    ],
    pdfSections: [
      {
        heading: 'Правило',
        bullets: ['Словосочетание = главное слово + зависимое; основа предложения — не словосочетание.', 'Проверка — менять форму главного слова и смотреть, что будет с зависимым.']
      },
      {
        heading: 'Три вида связи',
        table: {
          headers: ['Вид', 'Признак', 'Пример'],
          rows: [
            ['согласование', 'меняется вместе с главным', 'красивый дом -> красивого дома'],
            ['управление', 'падеж зависимого фиксирован', 'читать/читаю/читал книгу'],
            ['примыкание', 'слово неизменяемое', 'говорить громко, её книга']
          ]
        }
      }
    ]
  },
  {
    slug: 'one-part-sentence',
    ruName: 'Односоставные предложения',
    postTitle: 'Односоставные предложения: пять типов',
    coverPrompt: 'Editorial photo of a single spotlight illuminating an empty stage, moody atmosphere, minimalist composition, no readable text',
    richDoc: [
      p([
        'В односоставном предложении грамматическая основа состоит только из ',
        {text: 'одного', bold: true},
        ' главного члена — и предложение при этом остаётся полным, завершённым, ничего «не потерявшим». ',
        {text: 'Ночь.', italic: true},
        ' — это не обрывок фразы, а вполне самостоятельное предложение.'
      ]),
      tableNode({
        headers: ['Тип', 'Форма основы', 'Пример'],
        rows: [
          ['назывное', 'только подлежащее, без действия', 'Ночь. Тишина.'],
          ['определённо-личное', 'сказуемое 1/2 л. наст./буд. или повел. накл.', 'Иду домой. Позвони мне.'],
          ['неопределённо-личное', 'сказуемое 3 л. мн.ч. наст./буд. или мн.ч. прош.', 'В дверь постучали.'],
          ['обобщённо-личное', 'форма как у 2 л. ед.ч. или 3 л. мн.ч., но лицо любое', 'Цыплят по осени считают.'],
          ['безличное', 'подлежащего нет и быть не может', 'Смеркается. Мне нездоровится. Нет времени.']
        ]
      }),
      bq([
        [
          {text: 'Чаще всего путают', bold: true},
          ' неопределённо-личное с обобщённо-личным: в обоих сказуемое во множественном числе, но у неопределённо-личного деятель конкретен, просто не назван («постучали» — кто-то определённый), а у обобщённо-личного речь идёт вообще о любом человеке — почти всегда это пословицы.'
        ]
      ])
    ],
    pdfSections: [
      {
        heading: 'Пять типов',
        table: {
          headers: ['Тип', 'Форма основы', 'Пример'],
          rows: [
            ['назывное', 'только подлежащее', 'Ночь. Тишина.'],
            ['определённо-личное', 'сказ. 1/2 л.', 'Иду домой. Позвони.'],
            ['неопределённо-личное', 'сказ. 3 л. мн.ч.', 'В дверь постучали.'],
            ['обобщённо-личное', 'любое лицо, часто пословица', 'Цыплят по осени считают.'],
            ['безличное', 'подлежащего нет и не может быть', 'Смеркается. Нет времени.']
          ]
        }
      },
      {heading: 'Частая путаница', bullets: ['Неопределённо-личное: деятель есть, но не назван (постучали).', 'Обобщённо-личное: деятель — вообще любой человек, обычно пословица.']}
    ],
    testUpdates: [
      {
        title: 'Односоставные предложения: короткая проверка',
        blocks: [
          matchPairsBlock([
            {left: 'назывное', right: 'Ночь. Тишина.'},
            {left: 'определённо-личное', right: 'Иду домой.'},
            {left: 'неопределённо-личное', right: 'В дверь постучали.'},
            {left: 'обобщённо-личное', right: 'Цыплят по осени считают.'},
            {left: 'безличное', right: 'Смеркается.'}
          ]),
          chooseBlock('Предложение «Ночь. Тишина.» — это:', ['назывное', 'безличное', 'неопределённо-личное'], 0),
          chooseBlock('Предложение «Иду домой» — это:', ['определённо-личное', 'безличное', 'назывное'], 0),
          chooseBlock('Предложение «В дверь постучали» — это:', ['неопределённо-личное', 'определённо-личное', 'назывное'], 0),
          chooseBlock('Предложение «Смеркается» — это:', ['безличное', 'назывное', 'обобщённо-личное'], 0),
          chooseBlock('В определённо-личном предложении сказуемое стоит в форме:', ['1-го или 2-го лица', '3-го лица мн.ч.', 'прошедшего времени'], 0)
        ]
      },
      {
        title: 'Односоставные предложения: большой тест',
        blocks: [
          matchPairsBlock([
            {left: 'назывное', right: 'Зимний вечер.'},
            {left: 'определённо-личное', right: 'Позвони мне вечером.'},
            {left: 'неопределённо-личное', right: 'В газетах писали о новом законе.'},
            {left: 'обобщённо-личное', right: 'Без труда не вытащишь и рыбку из пруда.'},
            {left: 'безличное', right: 'Мне нездоровится.'}
          ]),
          chooseBlock('Предложение «В дверь постучали» — это:', ['неопределённо-личное', 'определённо-личное', 'назывное'], 0),
          chooseBlock('Предложение «Цыплят по осени считают» — это:', ['обобщённо-личное', 'неопределённо-личное', 'назывное'], 0),
          chooseBlock('Предложение «Нет времени на разговоры» — это:', ['безличное', 'назывное', 'определённо-личное'], 0),
          chooseBlock('Предложение «Соберите вещи и выходите» — это:', ['определённо-личное', 'неопределённо-личное', 'обобщённо-личное'], 0),
          chooseBlock('В безличном предложении подлежащее:', ['отсутствует и невозможно', 'подразумевается', 'выражено местоимением'], 0),
          chooseBlock('В неопределённо-личном предложении деятель:', ['неизвестен или неважен', 'ясен из формы глагола', 'назван существительным'], 0),
          chooseBlock('Обобщённо-личные предложения чаще всего встречаются в:', ['пословицах и поговорках', 'официальных документах', 'диалогах'], 0),
          chooseBlock('Предложение «Иду домой» — это:', ['определённо-личное', 'безличное', 'назывное'], 0),
          chooseBlock('Предложение «Смеркается» — это:', ['безличное', 'назывное', 'обобщённо-личное'], 0)
        ]
      }
    ]
  },
  {
    slug: 'homogeneous-parts',
    ruName: 'Однородные члены предложения',
    postTitle: 'Однородные члены предложения: союзы и знаки препинания',
    coverPrompt: 'Flat lay photo of a row of identical pencils arranged in parallel on lined paper, soft daylight, no readable text',
    richDoc: [
      p([
        'Однородные члены отвечают на один и тот же вопрос, относятся к одному и тому же слову и равноправны между собой — ни один не подчиняется другому. Запятая между ними зависит не от интуиции, а от ',
        {text: 'типа союза', bold: true},
        '.'
      ]),
      ul([
        [{text: 'Соединительные', bold: true}, ' (и, да=и, ни...ни) — одиночный ', {text: 'и', italic: true}, ' без запятой: ', {text: 'Он читал и писал.', italic: true}, ' Повторяющийся — запятая между всеми: ', {text: 'Он читал, и писал, и рисовал.', italic: true}],
        [{text: 'Разделительные', bold: true}, ' (или, либо, то...то) — при повторе тоже запятые: ', {text: 'То дождь, то снег.', italic: true}],
        [{text: 'Противительные', bold: true}, ' (а, но, зато, однако) — запятая ставится ВСЕГДА, даже если союз одиночный: ', {text: 'Он не читал, а слушал.', italic: true}]
      ]),
      bq([
        [
          {text: 'Самая частая ошибка', bold: true},
          ' — пропуск запятой перед ',
          {text: 'а', italic: true},
          '/',
          {text: 'но', italic: true},
          ': их по инерции путают с соединительными союзами и не ставят знак. Запятая перед противительным союзом — не «когда есть пауза», а всегда, без исключений.'
        ]
      ]),
      p([
        'Отдельная история — обобщающее слово. Если оно стоит перед перечислением, дальше идёт двоеточие: ',
        {text: 'В саду росли цветы: розы, тюльпаны, нарциссы.', italic: true},
        ' Если после — тире: ',
        {text: 'Розы, тюльпаны, нарциссы — всё это росло в саду.', italic: true}
      ])
    ],
    pdfSections: [
      {
        heading: 'Правило',
        bullets: [
          'Однородные члены отвечают на один вопрос, относятся к одному слову, равноправны.',
          'Одиночный союз и/или — запятая не ставится.',
          'Повторяющийся союз (и...и, то...то) — запятая между всеми членами.'
        ]
      },
      {
        heading: 'Частые ошибки',
        bullets: [
          'Перед а/но запятая ставится ВСЕГДА, даже при одиночном союзе — это и путают чаще всего.',
          'Обобщающее слово перед перечислением — двоеточие: цветы: розы, тюльпаны.',
          'Обобщающее слово после перечисления — тире: розы, тюльпаны — цветы.'
        ]
      }
    ],
    testUpdates: [
      {
        title: 'Однородные члены: короткая проверка',
        blocks: [
          fillTextBlockMulti([
            ['Он не читал', {gap: ','}, ' а слушал.'],
            ['В саду росли цветы', {gap: ':'}, ' розы, тюльпаны, нарциссы.'],
            ['Розы, тюльпаны, нарциссы', {gap: '—'}, ' всё это росло в саду.'],
            ['Он читал', {gap: ','}, ' и писал, и рисовал.'],
            ['То снег', {gap: ','}, ' то дождь шёл весь день.']
          ]),
          highlightTextBlockInline('Выделите однородные члены предложения', 'В саду росли розы, тюльпаны и нарциссы.', ['розы,', 'тюльпаны', 'нарциссы.'])
        ]
      },
      {
        title: 'Однородные члены: большой тест',
        blocks: [
          fillTextBlockMulti([
            ['Он не спорил', {gap: ','}, ' а соглашался.'],
            ['На столе лежали книги', {gap: ':'}, ' учебники, тетради, словари.'],
            ['Учебники, тетради, словари', {gap: '—'}, ' всё лежало на столе.'],
            ['Мы гуляли', {gap: ','}, ' и читали, и разговаривали.'],
            ['Не то ветер выл', {gap: ','}, ' не то кто-то стонал.'],
            ['Он не обиделся', {gap: ','}, ' а рассмеялся.'],
            ['Друзья пришли не с пустыми руками', {gap: ','}, ' а с подарками.']
          ]),
          highlightTextBlockInline('Выделите однородные члены предложения', 'Дети рисовали, пели и танцевали на празднике.', ['рисовали,', 'пели', 'танцевали']),
          highlightTextBlockInline('Выделите однородные члены предложения', 'На выставке были картины, скульптуры и фотографии.', ['картины,', 'скульптуры', 'фотографии.']),
          highlightTextBlockInline('Выделите однородные члены предложения', 'Мальчик был весёлым, добрым и отзывчивым.', ['весёлым,', 'добрым,', 'отзывчивым.']),
          chooseBlock('Однородные члены отвечают:', ['на один и тот же вопрос и относятся к одному слову', 'на разные вопросы', 'к разным словам в предложении'], 0),
          chooseBlock('Перед повторяющимся союзом и (и...и...) запятая между однородными членами:', ['ставится', 'не ставится', 'ставится только один раз'], 0)
        ]
      }
    ]
  },
  {
    slug: 'isolated-members',
    ruName: 'Обособленные определения и обстоятельства',
    postTitle: 'Обособленные определения и обстоятельства: причастный и деепричастный обороты',
    coverPrompt: 'Editorial photo of a comma-shaped paper cutout resting beside an open notebook, warm light, minimalist composition, no readable text',
    richDoc: [
      p([
        {text: 'Обособление', bold: true},
        ' — это выделение второстепенного члена запятыми, чтобы подчеркнуть его смысловую самостоятельность. Правило звучит почти всегда одинаково: ',
        {text: 'позиция решает', italic: true},
        '.'
      ]),
      h(3, 'Причастный оборот'),
      ul([
        [{text: 'После определяемого слова', bold: true}, ' — обособляется: ', {text: 'Книга, лежащая на столе, была открыта.', italic: true}],
        [{text: 'Перед определяемым словом', bold: true}, ' — обычно НЕ обособляется: ', {text: 'Лежащая на столе книга была открыта.', italic: true}],
        ['Но обособляется всегда независимо от места, если относится к личному местоимению (', {text: 'Уставший, он сел отдохнуть', italic: true}, ') или имеет добавочное значение причины/уступки (', {text: 'Испуганные грозой, дети спрятались в доме', italic: true}, ').']
      ]),
      h(3, 'Деепричастный оборот'),
      p([
        'Обособляется почти всегда, независимо от места: ',
        {text: 'Возвращаясь домой, он думал о разговоре.', italic: true},
        ' Одиночное деепричастие тоже обособляется, если сохраняет значение добавочного действия: ',
        {text: 'Мальчик, смеясь, убежал.', italic: true}
      ]),
      bq([
        [
          {text: 'Исключение: ', bold: true},
          'деепричастия, ставшие фразеологизмами, не обособляются — они срослись с глаголом в устойчивое выражение: ',
          {text: 'бежал сломя голову, работать спустя рукава', italic: true},
          '.'
        ]
      ])
    ],
    pdfSections: [
      {
        heading: 'Причастный оборот',
        bullets: [
          'После определяемого слова — обособляется: Книга, лежащая на столе, ...',
          'Перед определяемым словом — обычно НЕ обособляется.',
          'Обособляется всегда при личном местоимении или значении причины/уступки.'
        ]
      },
      {
        heading: 'Деепричастный оборот',
        bullets: [
          'Обособляется почти всегда, независимо от места: Возвращаясь домой, он думал...',
          'Одиночное деепричастие — если сохраняет значение добавочного действия: Мальчик, смеясь, убежал.',
          'Исключение — фразеологизмы: бежал сломя голову, работать спустя рукава.'
        ]
      }
    ]
  },
  {
    slug: 'introductory-words',
    ruName: 'Вводные слова, конструкции и обращения',
    postTitle: 'Вводные слова, конструкции и обращения',
    coverPrompt:
      'Editorial still life of a vintage rotary phone next to an open notebook, symbolizing speech and commentary, warm sepia tones, no readable text',
    richDoc: [
      p([
        'Вводные слова выражают отношение говорящего к тому, что он говорит: уверенность, сомнение, источник сведений, эмоцию, порядок мыслей. Грамматически они ',
        {text: 'ничему в предложении не подчиняются', bold: true},
        ' — к ним нельзя задать вопрос от других слов, и предложение без них не теряет структуру, только оттенок смысла.'
      ]),
      bq([
        [
          {text: 'Тест на вводность: ', bold: true},
          'уберите слово из предложения. Если грамматика не пострадала — оно вводное. «Он, кажется, устал» -> «Он устал» звучит нормально, значит «кажется» — вводное.'
        ]
      ]),
      h(3, 'Омонимичные случаи'),
      p([
        {text: 'Однако', bold: true},
        ' в начале предложения — союз, равный ',
        {text: 'но', italic: true},
        ' (запятая после не ставится): ',
        {text: 'Однако дождь не прекращался.', italic: true},
        ' В середине — вводное слово, обособляется: ',
        {text: 'Дождь, однако, не прекращался.', italic: true},
        ' Похожая история с ',
        {text: 'кажется', bold: true},
        ': вводное, если его можно убрать (',
        {text: 'Он, кажется, устал', italic: true},
        '), и сказуемое, если нельзя (',
        {text: 'Мне всё кажется странным', italic: true},
        ' — здесь это грамматическая основа).'
      ]),
      p([
        {text: 'Обращения', bold: true},
        ' — отдельная категория: они называют того, к кому обращаются, не являются членом предложения и всегда выделяются запятыми: ',
        {text: 'Мама, посмотри сюда!', italic: true}
      ])
    ],
    pdfSections: [
      {
        heading: 'Правило',
        bullets: [
          'Вводное слово не является членом предложения, к нему нельзя задать вопрос.',
          'Проверка: убрать слово — если структура не пострадала, оно вводное.'
        ]
      },
      {
        heading: 'Омонимичные случаи',
        bullets: [
          '«Однако» в начале предложения = союз (=но), запятая после не ставится.',
          '«Однако» в середине = вводное слово, обособляется запятыми.',
          '«Кажется» вводное (можно убрать) или сказуемое (нельзя убрать, это основа).',
          'Обращения — не член предложения, всегда с запятыми: Мама, посмотри сюда!'
        ]
      }
    ],
    testUpdates: [
      {
        title: 'Вводные слова и обращения: короткая проверка',
        blocks: [
          matchPairsBlock([
            {left: 'конечно', right: 'уверенность'},
            {left: 'кажется', right: 'сомнение'},
            {left: 'по-моему', right: 'источник сообщения'},
            {left: 'к счастью', right: 'эмоция'},
            {left: 'во-первых', right: 'порядок мыслей'}
          ]),
          chooseBlock('«Он, кажется, устал». Слово «кажется» — это:', ['вводное слово', 'сказуемое', 'дополнение'], 0),
          chooseBlock('«Мне всё кажется странным». Слово «кажется» — это:', ['сказуемое', 'вводное слово', 'обращение'], 0),
          chooseBlock('«Однако дождь не прекращался» (в начале предложения). «Однако» — это:', ['союз (=но)', 'вводное слово', 'обращение'], 0),
          chooseBlock('«Дождь, однако, не прекращался» (в середине). «Однако» — это:', ['вводное слово', 'союз', 'дополнение'], 0),
          chooseBlock('«Мама, посмотри сюда!» Слово «мама» — это:', ['обращение', 'подлежащее', 'вводное слово'], 0)
        ]
      },
      {
        title: 'Вводные слова и обращения: большой тест',
        blocks: [
          matchPairsBlock([
            {left: 'конечно', right: 'уверенность'},
            {left: 'кажется', right: 'сомнение'},
            {left: 'по-моему', right: 'источник сообщения'},
            {left: 'к счастью', right: 'эмоция'},
            {left: 'во-первых', right: 'порядок мыслей'},
            {left: 'к сожалению', right: 'эмоция'},
            {left: 'безусловно', right: 'уверенность'}
          ]),
          chooseBlock('«К счастью, дождь закончился». Слово «к счастью» — это:', ['вводное слово', 'дополнение', 'обстоятельство'], 0),
          chooseBlock('«Он, кажется, устал». Слово «кажется» — это:', ['вводное слово', 'сказуемое', 'дополнение'], 0),
          chooseBlock('«Мне всё кажется странным». Слово «кажется» — это:', ['сказуемое', 'вводное слово', 'обращение'], 0),
          chooseBlock('«Однако дождь не прекращался» (в начале предложения). «Однако» — это:', ['союз (=но)', 'вводное слово', 'обращение'], 0),
          chooseBlock('«Дождь, однако, не прекращался» (в середине). «Однако» — это:', ['вводное слово', 'союз', 'дополнение'], 0),
          chooseBlock('Чтобы проверить, вводное ли слово, нужно:', ['попробовать убрать его из предложения', 'поставить вопрос от сказуемого', 'посмотреть на его место в предложении'], 0),
          chooseBlock('«Дорогие друзья, начинаем урок». «Дорогие друзья» — это:', ['обращение', 'подлежащее', 'определение'], 0),
          chooseBlock('Обращение является членом предложения?', ['нет, не является', 'да, подлежащим', 'да, дополнением'], 0),
          chooseBlock('Вводные слова на письме выделяются:', ['запятыми', 'тире', 'двоеточием'], 0)
        ]
      }
    ]
  },
  {
    slug: 'compound-sentence',
    ruName: 'Сложносочинённое предложение',
    postTitle: 'Сложносочинённое предложение: союзы и смысловые отношения',
    coverPrompt: 'Abstract photo of two intertwined ropes of equal length on a wooden surface, symbolizing equal connected parts, soft light, no readable text',
    richDoc: [
      p([
        'Сложносочинённое предложение (ССП) — это союз двух равноправных частей: ни одна не зависит от другой, и вопрос от одной части к другой задать нельзя. Этим оно принципиально отличается от СПП, где придаточная часть всегда подчинена главной.'
      ]),
      tableNode({
        headers: ['Тип союза', 'Союзы', 'Смысл', 'Пример'],
        rows: [
          ['соединительные', 'и, тоже, также', 'одновременность / последовательность', 'Солнце село, и стемнело.'],
          ['разделительные', 'или, либо, то...то', 'чередование', 'То светило солнце, то шёл дождь.'],
          ['противительные', 'а, но, зато, однако', 'противопоставление', 'Он спешил, но опоздал.']
        ]
      }),
      bq([
        [
          {text: 'Исключение из общего правила: ', bold: true},
          'запятая перед одиночным союзом ',
          {text: 'и', italic: true},
          ' не ставится, если у частей есть общий второстепенный член или общее вводное слово: ',
          {text: 'К вечеру потеплело и пошёл дождь', italic: true},
          ' (общее «к вечеру» относится к обеим частям сразу).'
        ]
      ])
    ],
    pdfSections: [
      {
        heading: 'Правило',
        bullets: ['ССП — равноправные части, соединены сочинительным союзом, друг от друга не зависят.', 'Запятая перед союзом ставится по умолчанию между частями.']
      },
      {
        heading: 'Союзы по значению',
        table: {
          headers: ['Тип', 'Союзы', 'Пример'],
          rows: [
            ['соединительные', 'и, тоже, также', 'Солнце село, и стемнело.'],
            ['разделительные', 'или, то...то', 'То солнце, то дождь.'],
            ['противительные', 'а, но, зато', 'Спешил, но опоздал.']
          ]
        }
      },
      {heading: 'Исключение', bullets: ['Запятая НЕ ставится при общем второстепенном члене/вводном слове с одиночным и: К вечеру потеплело и пошёл дождь.']}
    ]
  },
  {
    slug: 'asyndetic-sentence',
    ruName: 'Бессоюзное сложное предложение',
    postTitle: 'Бессоюзное сложное предложение: как выбрать знак препинания',
    coverPrompt: 'Minimalist photo of scattered punctuation-shaped paper cutouts (comma, colon, dash) on a desk, soft light, no readable text',
    richDoc: [
      p([
        'В бессоюзном сложном предложении (БСП) части держатся вместе только интонацией и смыслом — союза нет вообще. Поэтому знак препинания приходится выбирать не по формальному признаку, а по ',
        {text: 'смысловому отношению', bold: true},
        ' между частями. Рабочий приём: мысленно подставить союз, который подходит по смыслу, — какой союз подойдёт, такой знак и нужен.'
      ]),
      tableNode({
        headers: ['Знак', 'Можно вставить', 'Значение', 'Пример'],
        rows: [
          ['запятая', 'и', 'перечисление событий', 'Дождь стучал по крыше, ветер гнул деревья.'],
          ['точка с запятой', '(пауза)', 'части менее тесно связаны, уже осложнены', 'Лес молчал; где-то далеко куковала кукушка.'],
          ['двоеточие', 'потому что / а именно', 'пояснение или причина', 'Я знаю: он не подведёт.'],
          ['тире', 'а / но / поэтому / если', 'противопоставление, следствие, условие', 'Ударил мороз — река встала.']
        ]
      }),
      bq([[{text: 'Тире — самый «многозначный» знак в БСП: ', bold: true}, 'он покрывает и противопоставление, и быструю смену событий, и вывод, и условие. Проверяйте союзом-подстановкой, а не интуицией.']])
    ],
    pdfSections: [
      {
        heading: 'Алгоритм',
        bullets: ['БСП — части связаны только интонацией, без союзов.', 'Мысленно подставьте союз по смыслу — он и укажет знак.']
      },
      {
        heading: 'Знак -> значение',
        table: {
          headers: ['Знак', 'Подставить', 'Значение'],
          rows: [
            ['запятая', 'и', 'перечисление'],
            ['точка с запятой', '—', 'части слабо связаны, уже осложнены'],
            ['двоеточие', 'потому что / а именно', 'пояснение, причина'],
            ['тире', 'а/но/поэтому/если', 'противопоставление, следствие, условие']
          ]
        }
      }
    ],
    testUpdates: [
      {
        title: 'БСП: короткая проверка',
        blocks: [
          fillTextBlockMulti([
            ['Дождь стучал по крыше', {gap: ','}, ' ветер гнул деревья.'],
            ['Я знаю', {gap: ':'}, ' он не подведёт.'],
            ['Ударил мороз', {gap: '—'}, ' река встала.'],
            ['Любишь кататься', {gap: '—'}, ' люби и саночки возить.'],
            ['Лес молчал', {gap: ';'}, ' где-то далеко куковала кукушка.']
          ]),
          chooseBlock('В БСП части соединяются:', ['только интонацией, без союзов', 'сочинительными союзами', 'подчинительными союзами'], 0)
        ]
      },
      {
        title: 'БСП: большой тест',
        blocks: [
          fillTextBlockMulti([
            ['Погода испортилась', {gap: ','}, ' небо потемнело.'],
            ['Он не пришёл', {gap: ':'}, ' заболел.'],
            ['Наступила весна', {gap: '—'}, ' прилетели скворцы.'],
            ['Слово не воробей', {gap: '—'}, ' вылетит, не поймаешь.'],
            ['Лес был густой', {gap: ';'}, ' в нём легко было заблудиться, особенно вечером.'],
            ['Собака залаяла', {gap: ','}, ' кошка спряталась под крыльцо.'],
            ['Я выглянул в окно', {gap: ':'}, ' на улице шёл снег.'],
            ['Поработаешь до пота', {gap: '—'}, ' пообедаешь в охоту.'],
            ['Ветер стих', {gap: ','}, ' дождь прекратился.'],
            ['Сад был большой', {gap: ';'}, ' в нём росли яблони, груши и вишни, посаженные ещё дедом.']
          ]),
          chooseBlock('Точка с запятой в БСП ставится, если части:', ['менее тесно связаны и уже осложнены своими знаками препинания', 'означают быструю смену событий', 'означают условие'], 0),
          chooseBlock('Двоеточие в БСП можно заменить союзом:', ['потому что / а именно', 'и', 'но'], 0),
          chooseBlock('Тире в БСП можно заменить союзом:', ['а, но, поэтому, если', 'и', 'что'], 0),
          chooseBlock('Запятая в БСП ставится, если части:', ['перечисляют одновременные или последовательные события', 'противопоставлены', 'являются выводом'], 0)
        ]
      }
    ]
  },
  {
    slug: 'direct-speech',
    ruName: 'Прямая речь, косвенная речь, цитирование',
    postTitle: 'Прямая речь, косвенная речь и цитирование',
    coverPrompt: 'Editorial photo of an open book with a speech-bubble-shaped paper cutout resting on the page, warm light, no readable text',
    richDoc: [
      p([
        'Прямая речь передаёт слова говорящего ',
        {text: 'дословно', bold: true},
        ' и оформляется как отдельное предложение со словами автора. Пунктуация зависит только от одного — где именно стоят слова автора относительно реплики.'
      ]),
      tableNode({
        headers: ['Схема', 'Пример'],
        rows: [
          ['А: «П».', 'Мама сказала: «Скоро будем ужинать».'],
          ['«П», — а.', '«Скоро будем ужинать», — сказала мама.'],
          ['«П, — а, — п».', '«Скоро, — сказала мама, — будем ужинать».'],
          ['«П, — а. — П».', '«Уже поздно, — сказала мама. — Пора спать».']
        ]
      }),
      h(3, 'Перевод в косвенную речь'),
      p([
        'Косвенная речь передаёт содержание не дословно, кавычки исчезают, а предложение превращается в придаточное изъяснительное. Важно: ',
        {text: 'местоимения меняются', bold: true},
        ' с позиции говорящего на позицию автора.'
      ]),
      ul([
        ['Утверждение -> ', {text: 'что', italic: true}, ': ', {text: 'Мама сказала: «Я приду поздно»', italic: true}, ' -> ', {text: 'Мама сказала, что она придёт поздно.', italic: true}],
        ['Побуждение -> ', {text: 'чтобы', italic: true}, ': ', {text: 'Он попросил: «Помоги мне»', italic: true}, ' -> ', {text: 'Он попросил, чтобы ему помогли.', italic: true}],
        ['Вопрос -> ', {text: 'ли', italic: true}, ' или вопросительное слово, без «?»: ', {text: 'Она спросила: «Который час?»', italic: true}, ' -> ', {text: 'Она спросила, который час.', italic: true}]
      ]),
      bq([[{text: 'Цитата внутри предложения', bold: true}, ' сохраняет кавычки, но теряет двоеточие и заглавную букву: ', {text: 'он писал, что «гений и злодейство — две вещи несовместные».', italic: true}]])
    ],
    pdfSections: [
      {
        heading: 'Схемы пунктуации',
        table: {
          headers: ['Схема', 'Пример'],
          rows: [
            ['А: «П».', 'Мама сказала: «Скоро будем ужинать».'],
            ['«П», — а.', '«Скоро будем ужинать», — сказала мама.'],
            ['«П, — а, — п».', '«Скоро, — сказала мама, — будем ужинать».'],
            ['«П, — а. — П».', '«Уже поздно, — сказала мама. — Пора спать».']
          ]
        }
      },
      {
        heading: 'Перевод в косвенную речь',
        bullets: [
          'Утверждение -> что (местоимения меняются на позицию автора).',
          'Побуждение -> чтобы: Помоги мне -> чтобы ему помогли.',
          'Вопрос -> ли/вопросит. слово, без «?»: Который час? -> который час.',
          'Цитата в составе предложения — в кавычках, без двоеточия и заглавной буквы внутри.'
        ]
      }
    ],
    testUpdates: [
      {
        title: 'Прямая и косвенная речь: короткая проверка',
        blocks: [
          fillTextBlockMulti([
            ['Мама сказала', {gap: ':'}, ' «Скоро будем ужинать».'],
            ['«Скоро будем ужинать»', {gap: ','}, ' — сказала мама.'],
            ['Мама сказала, что', {gap: ' она'}, ' придёт поздно.'],
            ['Он попросил, чтобы', {gap: ' ему'}, ' помогли.'],
            ['Она спросила', {gap: ','}, ' который час.'],
            ['«Уже поздно', {gap: ','}, ' — сказала мама. — Пора спать».']
          ]),
          dialogueBlock(
            'Расставь реплики в правильном порядке: прямая речь, затем её пересказ в косвенной.',
            {a: 'Прямая речь', b: 'Косвенная речь'},
            [
              {speaker: 'a', text: 'Мама сказала: «Скоро будем ужинать».'},
              {speaker: 'b', text: 'Мама сказала, что скоро будем ужинать.'},
              {speaker: 'a', text: 'Он спросил: «Который час?»'},
              {speaker: 'b', text: 'Он спросил, который час.'},
              {speaker: 'a', text: 'Учитель попросил: «Помогите мне».'},
              {speaker: 'b', text: 'Учитель попросил, чтобы ему помогли.'}
            ]
          )
        ]
      },
      {
        title: 'Прямая и косвенная речь: большой тест',
        blocks: [
          fillTextBlockMulti([
            ['Мама сказала', {gap: ':'}, ' «Скоро будем ужинать».'],
            ['«Скоро будем ужинать»', {gap: ','}, ' — сказала мама.'],
            ['Мама сказала, что', {gap: ' она'}, ' придёт поздно.'],
            ['Он попросил, чтобы', {gap: ' ему'}, ' помогли.'],
            ['Она спросила', {gap: ','}, ' который час.'],
            ['«Уже поздно', {gap: ','}, ' — сказала мама. — Пора спать».'],
            ['Учитель сказал', {gap: ':'}, ' «Завтра контрольная».'],
            ['«Завтра контрольная»', {gap: ','}, ' — сказал учитель.'],
            ['«Скоро', {gap: ','}, ' — сказала мама, — будем ужинать».'],
            ['Он сказал, что', {gap: ' он'}, ' устал.'],
            ['Учитель велел, чтобы', {gap: ' мы'}, ' выполнили задание.'],
            ['Она сказала', {gap: ':'}, ' «Я не согласна».']
          ]),
          dialogueBlock(
            'Расставь реплики в правильном порядке: прямая речь, затем её пересказ в косвенной.',
            {a: 'Прямая речь', b: 'Косвенная речь'},
            [
              {speaker: 'a', text: 'Мама сказала: «Скоро будем ужинать».'},
              {speaker: 'b', text: 'Мама сказала, что скоро будем ужинать.'},
              {speaker: 'a', text: 'Он спросил: «Который час?»'},
              {speaker: 'b', text: 'Он спросил, который час.'},
              {speaker: 'a', text: 'Учитель попросил: «Помогите мне».'},
              {speaker: 'b', text: 'Учитель попросил, чтобы ему помогли.'},
              {speaker: 'a', text: 'Друг сказал: «Я не пойду сегодня в кино».'},
              {speaker: 'b', text: 'Друг сказал, что он не пойдёт сегодня в кино.'},
              {speaker: 'a', text: 'Она спросила: «Ты закончил домашнюю работу?»'},
              {speaker: 'b', text: 'Она спросила, закончил ли я домашнюю работу.'}
            ]
          ),
          chooseBlock('Косвенная речь оформляется как:', ['придаточное изъяснительное без кавычек', 'предложение в кавычках', 'отдельное самостоятельное предложение'], 0)
        ]
      }
    ]
  }
]

// HighlightTextPayload: {instruction, tokens:[{id,text,isCorrect}]} — tokenized by
// splitting on spaces (same shape as wave 1's highlightTextBlock, re-declared here so
// this file has no import from seedRussianCourse03Syntax.ts).
function highlightTextBlockInline(instruction: string, sentence: string, correctTokens: string[]) {
  const words = sentence.split(' ')
  const correctSet = new Set(correctTokens)
  return {
    id: uid(),
    type: 'HIGHLIGHT_TEXT',
    payload: {instruction, tokens: words.map((text, i) => ({id: i, text, isCorrect: correctSet.has(text)}))}
  }
}

// ───────────────────────── main ─────────────────────────

interface Block {
  id: string
  type: string
  payload: Record<string, unknown>
}

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: TEACHER_EMAIL}})

  let migrated = 0
  let skipped = 0
  let coverFailures = 0

  for (const topic of TOPICS) {
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id, title: topic.postTitle}})
    if (!post) {
      console.log(`! пост для ${topic.slug} не найден — пропуск (запустите seedRussianCourse03Syntax.ts сначала)`)
      continue
    }

    const existingBlocks = (post.content as {blocks?: Block[]} | null)?.blocks ?? []
    const existingFileList = existingBlocks.find((b) => b.type === 'FILE_LIST')
    const existingFileUrl = (existingFileList?.payload?.files as {url: string}[] | undefined)?.[0]?.url
    if (existingFileUrl?.includes(CHEATSHEET_FOLDER)) {
      console.log(`= пропуск ${topic.slug} — уже мигрировано (${post.id})`)
      skipped++
      continue
    }

    console.log(`\n─── ${topic.slug} ───`)

    const pdfBuffer = await buildCheatSheetPdfV2(`${topic.ruName} — шпаргалка`, topic.pdfSections)
    const pdfUrl = await uploadBuffer(pdfBuffer, CHEATSHEET_FOLDER, 'pdf', teacher.id, 'application/pdf')
    console.log(`  + шпаргалка v2 (${pdfBuffer.length} байт): ${pdfUrl}`)

    const existingMedia = existingBlocks.find((b) => b.type === 'MEDIA')
    let mediaBlockOut: Block | ReturnType<typeof mediaBlock> | undefined = existingMedia
    try {
      const coverBuffer = await generateCoverImage(topic.coverPrompt)
      const coverUrl = await uploadBuffer(coverBuffer, COVER_FOLDER, 'png', teacher.id, 'image/png')
      mediaBlockOut = mediaBlock(coverUrl, `Обложка темы «${topic.ruName}»`)
      console.log(`  + обложка v3 (${coverBuffer.length} байт): ${coverUrl}`)
    } catch (e) {
      coverFailures++
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
      console.log(`  ! обложка v3 не сгенерирована (${msg}) — оставляю прежнюю обложку`)
    }

    const testLinkBlocks = existingBlocks.filter((b) => b.type === 'TEST_LINK')

    const blocks = [
      textBlock(topic.richDoc),
      ...(mediaBlockOut ? [mediaBlockOut] : []),
      ...testLinkBlocks,
      fileListBlock([{name: `${topic.ruName} — шпаргалка.pdf`, size: pdfBuffer.length, mimeType: 'application/pdf', url: pdfUrl}])
    ]

    await prisma.post.update({
      where: {id: post.id},
      data: {content: {blocks} as object, mediaUrls: extractMediaUrls(blocks)}
    })
    console.log(`  ~ пост обновлён: ${post.id}`)

    if (topic.testUpdates) {
      for (const tu of topic.testUpdates) {
        const test = await prisma.test.findFirst({
          where: {teacherId: teacher.id, title: tu.title, testCategories: {some: {categoryId: category.id}}}
        })
        if (!test) {
          console.log(`  ! тест "${tu.title}" не найден — пропуск`)
          continue
        }
        const prevContent = test.content as {description?: string} | null
        await prisma.test.update({
          where: {id: test.id},
          data: {content: {description: prevContent?.description ?? '', blocks: tu.blocks} as object}
        })
        console.log(`  ~ тест обновлён: "${tu.title}" (${tu.blocks.length} блоков)`)
      }
    }

    migrated++
  }

  console.log(`\n✅ Rich syntax pass: ${migrated} тем мигрировано, ${skipped} уже были готовы, ${coverFailures} обложек не сгенерировано (внешний ресурс).`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
