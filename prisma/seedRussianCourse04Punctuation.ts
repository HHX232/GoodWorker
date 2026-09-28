/**
 * Seed: блок «Пунктуация» курса «Русский язык» (тикет 04, .autopilot/russian-course/).
 * Идемпотентно: категории — upsert по slug; тема пропускается, если пост с её заголовком
 * в её категории уже существует; тесты внутри темы — findOrCreateTest по teacherId+title+категория
 * (переживает прогон, прерванный между созданием тестов и созданием поста).
 *
 * Независим от тикетов 01/02/03 — свои категории (`punctuation`-поддерево), свой файл.
 *
 * Run: npx tsx prisma/seedRussianCourse04Punctuation.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import {execFileSync} from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import {PutObjectCommand} from '@aws-sdk/client-s3'
import {PDFDocument, PDFFont, rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {s3, S3_BUCKET, publicUrlForKey} from '../src/shared/s3/s3Client'
import {PostBlockType} from '../src/shared/types/Post/Post.type'
import {TaskBlockType} from '../src/shared/types/Tasks/TaskType.type'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
// см. interfaces.md §9 (урок тикета 01): 'nano-banana-2' не существует в живом каталоге,
// актуальная рекомендованная модель — 'google/nano-banana', с явным output_format=jpeg.
const IMAGE_MODEL = 'google/nano-banana'
const COVERS_DIR = path.join(process.cwd(), '.tmp-russian-course-covers')

// ───────────────────────── small id/content helpers ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc04-${Date.now()}-${++_uidCounter}`
}

function textBlock(paragraphs: string[]) {
  return {
    id: uid(),
    type: PostBlockType.TEXT,
    payload: {
      content: {
        type: 'doc',
        content: paragraphs.map((text) => ({type: 'paragraph', content: [{type: 'text', text}]}))
      }
    }
  }
}

function mediaBlock(url: string, caption: string) {
  return {id: uid(), type: PostBlockType.MEDIA, payload: {kind: 'image', url, caption}}
}

function testLinkBlock(tests: {id: string; title: string}[]) {
  return {id: uid(), type: PostBlockType.TEST_LINK, payload: {tests}}
}

function fileListBlock(files: {name: string; size: number; mimeType: string; url: string}[]) {
  return {id: uid(), type: PostBlockType.FILE_LIST, payload: {files}}
}

function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]): string[] {
  return blocks
    .filter((b) => b.type === PostBlockType.MEDIA && typeof b.payload?.url === 'string')
    .map((b) => b.payload.url as string)
}

// FILL_TEXT gaps are `inputGap` tiptap atom nodes: {type:'inputGap', attrs:{gapId, answer}}
// (same shape as ticket 01 — confirmed via src/features/Tasks/TaskResult/scoreBlock.tsx `extractGaps`).
type FillPart = string | {gap: string}

function fillTextBlock(parts: FillPart[]) {
  const content: Record<string, unknown>[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      if (part) content.push({type: 'text', text: part})
    } else {
      content.push({type: 'inputGap', attrs: {gapId: uid(), answer: part.gap}})
    }
  }
  return {
    id: uid(),
    type: TaskBlockType.FILL_TEXT,
    payload: {content: {type: 'doc', content: [{type: 'paragraph', content}]}}
  }
}

function chooseBlock(question: string, options: string[], correctIndex: number) {
  const opts = options.map((text) => ({id: uid(), text}))
  return {
    id: uid(),
    type: TaskBlockType.CHOOSE_OPTION,
    payload: {question, options: opts, correctId: opts[correctIndex].id}
  }
}

// HIGHLIGHT_TEXT tokens: {id:number, text:string, isCorrect:boolean} — tokenizer regex copied
// verbatim from src/widgets/Tasks/BlockEditor/HighlightTextEditor/HighlightTextEditor.tsx `tokenize()`
// so the seeded payload matches exactly what the teacher-built editor would produce.
function tokenizeHighlight(text: string): {id: number; text: string; isCorrect: boolean}[] {
  const parts = text.match(/[\wА-Яа-яЁёA-Za-z'-]+|[^\wА-Яа-яЁё\s]/g) ?? []
  return parts.map((t, id) => ({id, text: t, isCorrect: false}))
}

function highlightBlock(instruction: string, text: string, correctWords: string[]) {
  const tokens = tokenizeHighlight(text).map((t) => ({...t, isCorrect: correctWords.includes(t.text)}))
  return {id: uid(), type: TaskBlockType.HIGHLIGHT_TEXT, payload: {instruction, tokens}}
}

// SEQUENCE: payload.items order IS the correct order (scoreBlock.tsx compares stored item-id
// order against the student's submitted order) — the student-facing UI shuffles for display.
function sequenceBlock(steps: string[]) {
  return {id: uid(), type: TaskBlockType.SEQUENCE, payload: {items: steps.map((text) => ({id: uid(), text}))}}
}

type BlockSpec =
  | {kind: 'choose'; question: string; options: string[]; correct: number}
  | {kind: 'fill'; parts: FillPart[]}
  | {kind: 'highlight'; instruction: string; text: string; correct: string[]}
  | {kind: 'sequence'; steps: string[]}

function buildTestBlock(spec: BlockSpec) {
  switch (spec.kind) {
    case 'choose':
      return chooseBlock(spec.question, spec.options, spec.correct)
    case 'fill':
      return fillTextBlock(spec.parts)
    case 'highlight':
      return highlightBlock(spec.instruction, spec.text, spec.correct)
    case 'sequence':
      return sequenceBlock(spec.steps)
  }
}

// ───────────────────────── S3 upload ─────────────────────────

async function uploadBuffer(buffer: Buffer, folder: string, ext: string, teacherId: string, contentType: string) {
  const key = `${folder}/${teacherId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType}))
  return publicUrlForKey(key)
}

// ───────────────────────── image generation (velsvisual) ─────────────────────────

async function generateCoverImage(prompt: string): Promise<Buffer> {
  await fs.mkdir(COVERS_DIR, {recursive: true})
  const stdout = execFileSync(
    'velsvisual',
    [
      'run',
      IMAGE_MODEL,
      '--prompt',
      prompt,
      '--set',
      'aspect_ratio=4:3',
      '--set',
      'output_format=jpeg',
      '--download',
      COVERS_DIR,
      '--wait',
      '--json'
    ],
    {encoding: 'utf8', maxBuffer: 1024 * 1024 * 20}
  )
  const result = JSON.parse(stdout.slice(stdout.indexOf('{')))
  const filePath: string = result.files[0]
  const buf = await fs.readFile(filePath)
  await fs.rm(filePath, {force: true})
  return buf
}

// ───────────────────────── PDF generation (pdf-lib + fontkit) ─────────────────────────

const A4: [number, number] = [595.28, 841.89]

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

async function buildCheatSheetPdf(title: string, lines: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const {regular, bold} = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const marginX = 50
  const maxWidth = A4[0] - marginX * 2
  let y = 780

  for (const titleLine of wrapText(title, bold, 20, maxWidth)) {
    page.drawText(titleLine, {x: marginX, y, size: 20, font: bold, color: rgb(0.04, 0.04, 0.04)})
    y -= 28
  }
  y -= 16

  for (const line of lines) {
    for (const wrapped of wrapText(`•  ${line}`, regular, 11.5, maxWidth)) {
      page.drawText(wrapped, {x: marginX, y, size: 11.5, font: regular, color: rgb(0.12, 0.12, 0.12)})
      y -= 18
    }
    y -= 8
  }
  return Buffer.from(await pdfDoc.save())
}

async function buildSummaryPdf(title: string, items: {name: string; line: string}[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const {regular, bold} = await loadFonts(pdfDoc)
  const page = pdfDoc.addPage(A4)
  const marginX = 50
  const maxWidth = A4[0] - marginX * 2
  let y = 780

  page.drawText(title, {x: marginX, y, size: 22, font: bold, color: rgb(0.04, 0.04, 0.04)})
  y -= 36

  for (const item of items) {
    page.drawText(item.name, {x: marginX, y, size: 13, font: bold, color: rgb(0.04, 0.04, 0.04)})
    y -= 18
    for (const wrapped of wrapText(item.line, regular, 11, maxWidth)) {
      page.drawText(wrapped, {x: marginX, y, size: 11, font: regular, color: rgb(0.15, 0.15, 0.15)})
      y -= 16
    }
    y -= 10
  }
  return Buffer.from(await pdfDoc.save())
}

// ───────────────────────── categories ─────────────────────────

// 4 leaves already in DB (verified via psql before writing this script):
// commas / colon / dash / quotation-marks, all levelNumber 3, parentId = punctuation.
const EXISTING_CATEGORY_SLUGS = ['commas', 'colon', 'dash', 'quotation-marks'] as const

const NEW_CATEGORIES: {slug: string; translations: Record<'ru' | 'en' | 'hi' | 'zh', string>}[] = [
  {
    slug: 'comma-isolation',
    translations: {
      ru: 'Запятая при обособленных членах',
      en: 'Comma with Isolated Sentence Parts',
      hi: 'पृथक्कृत वाक्यांशों में अल्पविराम',
      zh: '独立成分的逗号使用'
    }
  },
  {
    slug: 'complex-sentence-punctuation',
    translations: {
      ru: 'Знаки препинания в сложном предложении (сводно)',
      en: 'Punctuation in Complex Sentences: A Unified Algorithm',
      hi: 'जटिल वाक्य में विराम चिह्न (सारांश)',
      zh: '复合句中的标点符号（综合）'
    }
  },
  {
    slug: 'introductory-punctuation',
    translations: {
      ru: 'Пунктуация при вводных словах и обращениях',
      en: 'Punctuation with Parenthetical Words and Direct Address',
      hi: 'प्रासंगिक शब्दों और संबोधन में विराम चिह्न',
      zh: '插入语与称呼语的标点'
    }
  }
]

async function upsertCategory(slug: string, parentId: string, levelNumber: number, translations: Record<string, string>) {
  const cat = await prisma.category.upsert({
    where: {slug},
    create: {slug, levelNumber, parentId},
    update: {}
  })
  for (const [langCode, name] of Object.entries(translations)) {
    await prisma.categoryTranslation.upsert({
      where: {categoryId_langCode: {categoryId: cat.id, langCode}},
      create: {categoryId: cat.id, langCode, name},
      update: {name}
    })
  }
  return cat
}

// ───────────────────────── topic content ─────────────────────────

interface Topic {
  slug: string
  ruName: string
  postTitle: string
  explanation: string[]
  coverPrompt: string
  cheatSheetLines: string[]
  summaryLine: string
  shortTestTitle: string
  shortTestBlocks: BlockSpec[]
  largeTestTitle: string
  largeTestBlocks: BlockSpec[]
}

const TOPICS: Topic[] = [
  // ───────────── 1. commas (существующая категория) — HIGHLIGHT_TEXT ─────────────
  {
    slug: 'commas',
    ruName: 'Запятые: главные правила',
    postTitle: 'Запятые: главные правила расстановки',
    explanation: [
      'Запятая — самый частый знак препинания и самый частый источник ошибок на письме. Ниже — свод главных случаев её постановки: не единое правило, а восемь ситуаций, которые нужно научиться узнавать в тексте.',
      'Однородные члены без союзов разделяются запятой: «На поляне росли ромашки, васильки и колокольчики» (запятая только между первыми двумя — перед «и» перед последним однородным членом запятая не нужна). Если союз одиночный (и/или/либо) — запятая не ставится вовсе: «Дети играли во дворе и весело смеялись». Но если союз повторяется (и…и, или…или, ни…ни) — запятая ставится перед каждым союзом, начиная со второго: «И ромашки, и васильки цвели на лугу». Союзы а, но, однако между однородными членами всегда требуют запятой: «Ветер стих, но волны ещё бились».',
      'На границе частей сложного предложения запятая работает по двум разным правилам. В сложносочинённом предложении (части равноправны, соединены союзами и, а, но, да, зато) запятая ставится перед союзом: «Мама позвала меня, и я побежал домой». В сложноподчинённом предложении (одна часть главная, другая — зависимая) запятая ставится на границе главной и придаточной части, перед подчинительным союзом или союзным словом (что, чтобы, если, потому что, который): «Мы знали, что экзамен будет трудным».',
      'Обособленные обороты — причастный, деепричастный — выделяются запятыми с двух сторон, если стоят в середине предложения, или одной запятой, если оборот в начале или конце: «Дом, стоявший на холме, был виден издалека». Вводные слова и обращения выделяются запятыми независимо от места в предложении: «Конечно, мы поможем тебе»; «Ребята, приготовьтесь к старту».'
    ],
    coverPrompt:
      'Warm editorial close-up photo of a red pencil marking small dots on a handwritten notebook page, soft daylight, cozy study atmosphere, no readable text',
    cheatSheetLines: [
      'Однородные члены без союзов — между ними запятая: «На поляне росли ромашки, васильки и колокольчики».',
      'Однородные члены с одиночным союзом и/или/либо — запятая НЕ ставится: «Дети играли и весело смеялись».',
      'Однородные члены с противительными союзами а, но, однако — запятая всегда: «Ветер стих, но волны ещё бились».',
      'Повторяющиеся союзы и…и, или…или, ни…ни — запятая перед каждым союзом, начиная со второго: «И ромашки, и васильки цвели».',
      'Границы частей ССП (перед и, а, но, да, зато) — запятая: «Мама позвала меня, и я побежал домой».',
      'Границы главной и придаточной части СПП (перед что, чтобы, если, потому что, который) — запятая: «Мы знали, что экзамен будет трудным».',
      'Обособленные обороты (причастный, деепричастный) — запятые с двух сторон или одна, если оборот в начале/конце: «Дом, стоявший на холме, был виден издалека».',
      'Вводные слова и обращения — выделяются запятыми: «Конечно, мы поможем тебе»; «Ребята, приготовьтесь к старту».'
    ],
    summaryLine:
      'Запятая — самый частый знак: однородные члены, границы частей сложного предложения, обособленные обороты и вводные слова/обращения.',
    shortTestTitle: 'Запятые: короткая проверка',
    shortTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'На столе лежали книги тетради и карандаши', correct: ['книги']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Ветер стих но волны всё ещё бились о берег', correct: ['стих']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Мы остались дома потому что начался дождь', correct: ['дома']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Конечно мы поможем тебе завтра', correct: ['Конечно']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Сестра любит рисовать а брат увлекается музыкой', correct: ['рисовать']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая (если она вообще нужна)', text: 'Дети играли во дворе и весело смеялись', correct: []}
    ],
    largeTestTitle: 'Запятые: большой тест на расстановку',
    largeTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите слова, после которых нужна запятая', text: 'На лугу цвели и ромашки и васильки и колокольчики', correct: ['ромашки', 'васильки']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Он долго готовился однако экзамен сдал не очень удачно', correct: ['готовился']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Если завтра будет солнечно мы поедем на природу', correct: ['солнечно']},
      {kind: 'highlight', instruction: 'Выделите слова, после которых нужна запятая', text: 'Книга которую ты мне посоветовал оказалась очень интересной', correct: ['Книга', 'посоветовал']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Проверив домашнее задание учитель похвалил учеников', correct: ['задание']},
      {kind: 'highlight', instruction: 'Выделите слова, после которых нужна запятая', text: 'Дом стоявший на холме был виден издалека', correct: ['Дом', 'холме']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Ребята приготовьтесь к старту', correct: ['Ребята']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Хотелось погулять да времени совсем не было', correct: ['погулять']},
      {kind: 'highlight', instruction: 'Выделите слова, после которых нужна запятая', text: 'Мороз был крепкий сухой безветренный', correct: ['крепкий', 'сухой']},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая (если она вообще нужна)', text: 'Ты можешь остаться дома или пойти с нами', correct: []},
      {kind: 'highlight', instruction: 'Выделите слово, после которого нужна запятая', text: 'Мы поспешили чтобы успеть на поезд', correct: ['поспешили']},
      {kind: 'highlight', instruction: 'Выделите слова, после которых нужна запятая', text: 'Дождь кажется скоро закончится', correct: ['Дождь', 'кажется']}
    ]
  },

  // ───────────── 2. colon (существующая категория) — CHOOSE_OPTION ─────────────
  {
    slug: 'colon',
    ruName: 'Двоеточие',
    postTitle: 'Двоеточие: когда ставится и как проверить',
    explanation: [
      'Двоеточие сигнализирует, что дальше идёт раскрытие, разъяснение или прямая цитата того, о чём сказано в первой части. Есть простая опорная проверка: попробуйте мысленно вставить между частями слова «а именно», «потому что» или «и увидел, что» — если по смыслу подходит, нужно двоеточие.',
      'Первый случай — обобщающее слово перед однородными членами: «В корзине лежали фрукты: яблоки, груши, сливы» (фрукты — обобщающее слово, дальше идёт их перечисление, проверка «а именно» подходит).',
      'Второй и третий случаи — бессоюзное сложное предложение (БСП). Если вторая часть называет причину того, о чём говорится в первой (проверка «потому что»): «Я не пошёл гулять: начался дождь». Если вторая часть поясняет или раскрывает содержание первой (проверка «а именно» или «и увидел, что»): «Оглянулся: никого не было».',
      'Четвёртый случай — слова автора перед прямой речью: «Он сказал: «Я вернусь поздно»». Схема одна и та же во всех случаях: первая часть указывает, что дальше последует раскрытие, — и после неё ставится двоеточие.'
    ],
    coverPrompt:
      'Minimalist still life of a black fountain pen and an open notebook on a wooden desk, warm soft light, cozy academic mood, no readable text',
    cheatSheetLines: [
      'Опорная проверка: вставь между частями «а именно», «потому что» или «и увидел, что» — если по смыслу подходит, нужно двоеточие.',
      'Обобщающее слово перед однородными членами: «В корзине лежали фрукты: яблоки, груши, сливы».',
      'БСП, причина (=потому что): «Я не пошёл гулять: начался дождь».',
      'БСП, пояснение/раскрытие (=а именно/и увидел, что): «Оглянулся: никого не было».',
      'Слова автора перед прямой речью: «Он сказал: «Я вернусь поздно»»'
    ],
    summaryLine: 'Двоеточие — перед перечислением после обобщающего слова, перед причиной/пояснением в БСП и перед прямой речью после слов автора.',
    shortTestTitle: 'Двоеточие: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'choose',
        question: 'Мы взяли всё что нужно ___ палатку, спальники, котелок. Какой знак нужен после «нужно»?',
        options: ['двоеточие (обобщающее слово перед перечислением)', 'тире', 'запятая'],
        correct: 0
      },
      {
        kind: 'choose',
        question: 'Игорь остался дома ___ у него разболелась голова. Какой знак и почему?',
        options: ['двоеточие (вторая часть — причина)', 'тире (следствие)', 'запятая'],
        correct: 0
      },
      {
        kind: 'choose',
        question: 'Я поднял голову ___ прямо надо мной кружил орёл. Какой знак (проверка «и увидел, что»)?',
        options: ['двоеточие', 'точка', 'ничего не нужно'],
        correct: 0
      },
      {
        kind: 'choose',
        question: 'Он крикнул ___ «Осторожно!». Слова автора перед прямой речью — какой знак?',
        options: ['двоеточие', 'тире', 'запятая'],
        correct: 0
      },
      {
        kind: 'choose',
        question: 'Выберите пример, где двоеточие стоит верно',
        options: ['На столе: лежали книги.', 'На столе лежали книги: тетради, ручки, карандаши.', 'На столе лежали: книги тетради ручки.'],
        correct: 1
      },
      {
        kind: 'choose',
        question: 'В каком случае двоеточие СТАВИТСЯ?',
        options: ['В простом предложении без перечисления и пояснения', 'После обобщающего слова перед однородными членами', 'Между однородными членами без обобщающего слова'],
        correct: 1
      }
    ],
    largeTestTitle: 'Двоеточие: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Слышу ___ где-то вдалеке лает собака (проверка «и слышу, что»). Знак?', options: ['двоеточие', 'тире', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Не пришёл на встречу ___ заболел (причина). Знак?', options: ['двоеточие', 'тире', 'ничего'], correct: 0},
      {
        kind: 'choose',
        question: 'Все обрадовались ___ и взрослые, и дети (после обобщающего слова «все»). Нужен ли знак?',
        options: ['да, двоеточие', 'нет, запятая', 'нет, тире'],
        correct: 0
      },
      {kind: 'choose', question: 'Директор объявил ___ «Собрание переносится». Верный знак?', options: ['двоеточие', 'тире', 'точка с запятой'], correct: 0},
      {
        kind: 'choose',
        question: 'Выберите верный вариант',
        options: ['Он ответил: «Я согласен».', 'Он ответил «Я согласен».', 'Он ответил, «Я согласен».'],
        correct: 0
      },
      {
        kind: 'choose',
        question: 'Выберите верный вариант',
        options: ['В корзине лежали: яблоки, груши, сливы.', 'В корзине лежали яблоки, груши, сливы.', 'В корзине лежали фрукты: яблоки, груши, сливы.'],
        correct: 2
      },
      {
        kind: 'choose',
        question: 'Найдите пример с двоеточием в БСП со значением причины',
        options: ['Стало тихо: все ушли домой.', 'Стало тихо, все ушли домой.', 'Стало тихо — все ушли домой.'],
        correct: 0
      },
      {kind: 'choose', question: 'Оглянулся ___ никого не было (пояснение). Знак?', options: ['двоеточие', 'тире', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Понял одно ___ надо действовать быстро. Знак?', options: ['двоеточие', 'тире', 'точка'], correct: 0},
      {
        kind: 'choose',
        question: 'Все явились вовремя ___ и учителя, и ученики (после обобщающего слова «все»). Знак?',
        options: ['двоеточие', 'тире', 'ничего'],
        correct: 0
      },
      {kind: 'choose', question: 'Взгляд его говорил многое ___ он был счастлив (пояснение). Знак?', options: ['двоеточие', 'тире', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Мать спросила ___ «Ты поел?». Знак перед прямой речью?', options: ['двоеточие', 'тире', 'запятая'], correct: 0}
    ]
  },

  // ───────────── 3. dash (существующая категория) — CHOOSE_OPTION ─────────────
  {
    slug: 'dash',
    ruName: 'Тире',
    postTitle: 'Тире: когда ставится и когда — нет',
    explanation: [
      'Тире, в отличие от двоеточия, чаще ставится между равноправными частями или на месте пропущенного слова. Разберём, когда оно нужно, а когда — нет, несмотря на то что пауза в предложении как будто есть.',
      'Если подлежащее и сказуемое выражены существительными (или числительными) в именительном падеже без связки — ставится тире: «Москва — столица России». Но тире НЕ ставится, если перед сказуемым есть отрицание «не» или сравнительный союз (как, будто, словно): «Бедность не порок»; «Этот сад как рай» — если только не нужно особое интонационное подчёркивание.',
      'В неполном предложении, где пропущено слово (обычно сказуемое) и это ясно из параллельной конструкции, на месте пропуска ставится тире: «Слева — лес, справа — поле».',
      'В бессоюзном сложном предложении тире ставится при противопоставлении (проверка «а»): «Труд человека кормит — лень портит»; и при следствии или быстрой смене событий (проверка «поэтому»/«и вдруг»): «Ударил мороз — река стала».',
      'В диалоге тире ставится перед репликой, если она начинается с новой строки, а также после реплики перед словами автора: «Идём!» — скомандовал капитан.'
    ],
    coverPrompt:
      'Editorial photo of a long shadow cast by a wooden ruler across lined paper on a desk, warm afternoon light, minimalist composition, no readable text',
    cheatSheetLines: [
      'Подлежащее и сказуемое — существительные (или числительные) в И.п. без связки: «Москва — столица России».',
      'Тире НЕ ставится, если перед сказуемым «не» или сравнительный союз (как, будто, словно): «Бедность не порок»; «Этот сад как рай».',
      'Неполное предложение (пропуск сказуемого): «Слева — лес, справа — поле».',
      'БСП, противопоставление (=а): «Труд человека кормит — лень портит».',
      'БСП, следствие/быстрая смена событий (=поэтому/и вдруг): «Ударил мороз — река стала».',
      'Диалог: тире перед репликой с новой строки; после реплики перед словами автора — тоже тире: «Идём!» — скомандовал капитан.'
    ],
    summaryLine: 'Тире — между подлежащим и сказуемым-существительными, на месте пропуска слова, в БСП с противопоставлением/следствием и в диалоге.',
    shortTestTitle: 'Тире: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Пятью пять ___ двадцать пять. Нужно ли тире?', options: ['да (оба главных члена — числительные)', 'нет', 'да, но запятая вместо тире'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['Собака — друг человека.', 'Собака друг человека.', 'Собака, друг человека.'], correct: 0},
      {kind: 'choose', question: 'Бедность не порок. Нужно ли тире перед «не порок»?', options: ['да', 'нет (сказуемое с отрицанием «не»)', 'да, но запятая'], correct: 1},
      {kind: 'choose', question: 'Слева ___ лес, справа ___ поле (пропуск сказуемого). Сколько тире нужно?', options: ['одно', 'два', 'ни одного'], correct: 1},
      {kind: 'choose', question: 'Сказал ___ сделал (быстрая смена событий). Знак?', options: ['тире', 'двоеточие', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Этот сад как рай. Нужно ли тире перед «как рай»?', options: ['да', 'нет (сравнительный союз «как»)', 'да, но запятая'], correct: 1}
    ],
    largeTestTitle: 'Тире: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Труд человека кормит ___ лень портит (противопоставление). Знак?', options: ['тире', 'двоеточие', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Ударил мороз ___ река стала (следствие). Знак?', options: ['тире', 'двоеточие', 'точка'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['Дружба — это бесценный дар.', 'Дружба это бесценный дар.', 'Дружба, это бесценный дар.'], correct: 0},
      {kind: 'choose', question: 'Он не студент. Нужно ли тире?', options: ['да', 'нет (отрицание «не» перед сказуемым)', 'да, но запятая'], correct: 1},
      {kind: 'choose', question: '— Ты придёшь? ___ спросила она. Нужен ли тире перед словами автора в диалоге?', options: ['да', 'нет', 'да, но запятая вместо тире'], correct: 0},
      {kind: 'choose', question: 'Пруд как зеркало. Нужно ли тире?', options: ['да', 'нет (сравнение «как»)', 'да, но точка'], correct: 1},
      {kind: 'choose', question: 'Пятью пять ___ двадцать пять. Тире здесь потому что…', options: ['оба главных члена выражены числительными', 'это неполное предложение', 'это сравнение'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['Наша цель — победа.', 'Наша цель победа.', 'Наша цель, победа.'], correct: 0},
      {kind: 'choose', question: 'Найдите правильный по норме вариант БЕЗ тире (сравнение «как»)', options: ['Дом как обещание уюта.', 'Дом — как обещание уюта.', 'Дом, как обещание уюта.'], correct: 0},
      {kind: 'choose', question: 'В комнате слева ___ шкаф, справа ___ кровать (пропуск сказуемого). Сколько тире?', options: ['одно', 'два', 'ни одного'], correct: 1},
      {kind: 'choose', question: '«Идём!» ___ скомандовал капитан (реплика перед словами автора). Знак после реплики?', options: ['тире', 'двоеточие', 'запятая'], correct: 0},
      {kind: 'choose', question: 'Выберите верный пример на подлежащее и сказуемое-существительное', options: ['Чтение — вот лучшее учение.', 'Чтение вот лучшее учение.', 'Чтение, вот лучшее учение.'], correct: 0}
    ]
  },

  // ───────────── 4. quotation-marks (существующая категория) — FILL_TEXT ─────────────
  {
    slug: 'quotation-marks',
    ruName: 'Кавычки',
    postTitle: 'Кавычки: прямая речь, цитаты и особые случаи',
    explanation: [
      'Кавычки выделяют чужую речь, буквально переданную на письме, от собственной речи говорящего или пишущего. В русском письме стандартный парный знак — «ёлочки»: « и ».',
      'Прямая речь после слов автора оформляется так: А: «П» — «Он сказал: «Я вернусь поздно»». Если прямая речь стоит перед словами автора, схема другая: «П», — а — «Мы опоздаем», — сказала мама.',
      'Цитаты оформляются так же, как прямая речь: заключаются в кавычки с сохранением пунктуации автора.',
      'Отдельное слово или сочетание слов, употреблённое в переносном или ироничном значении, берётся в кавычки: «Друзья называли его «профессором» за любовь к чтению». Так же в кавычки заключаются названия книг, фильмов, журналов и организаций: роман «Война и мир».'
    ],
    coverPrompt:
      'Warm editorial photo of an open book on a wooden table, soft daylight, cozy reading nook atmosphere, no readable text',
    cheatSheetLines: [
      'Прямая речь после слов автора: А: «П». — Он сказал: «Я вернусь поздно».',
      'Прямая речь перед словами автора: «П», — а. — «Мы опоздаем», — сказала мама.',
      'Цитата оформляется в кавычках так же, как прямая речь.',
      'Слово в переносном/ироничном значении — в кавычках: друзья называли его «профессором».',
      'Названия книг, фильмов, журналов, организаций — в кавычках: роман «Война и мир».'
    ],
    summaryLine: 'Кавычки — вокруг прямой речи и цитат, вокруг слова в переносном/ироничном значении и вокруг названий.',
    shortTestTitle: 'Кавычки: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['Она сказала: ', {gap: '«'}, 'Уже поздно', {gap: '»'}, '.']},
      {kind: 'fill', parts: [{gap: '«'}, 'Мы опоздаем', {gap: '»'}, ', — сказала мама.']},
      {kind: 'fill', parts: ['Друзья называли его ', {gap: '«'}, 'профессором', {gap: '»'}, ' за любовь к чтению.']},
      {kind: 'fill', parts: ['Мы читали роман ', {gap: '«'}, 'Война и мир', {gap: '»'}, '.']},
      {kind: 'fill', parts: ['Учитель произнёс: ', {gap: '«'}, 'Тишина в классе', {gap: '»'}, '.']},
      {kind: 'fill', parts: ['Она гордо называла себя ', {gap: '«'}, 'звездой', {gap: '»'}, ' двора.']}
    ],
    largeTestTitle: 'Кавычки: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['Отец спросил: ', {gap: '«'}, 'Ты готов', {gap: '»'}, '?']},
      {kind: 'fill', parts: [{gap: '«'}, 'Пора идти', {gap: '»'}, ', — произнёс он тихо.']},
      {kind: 'fill', parts: ['В сочинении он процитировал Пушкина: ', {gap: '«'}, 'Я вас любил', {gap: '»'}, '.']},
      {kind: 'fill', parts: ['Мы посмотрели фильм ', {gap: '«'}, 'Приключение', {gap: '»'}, ' в субботу.']},
      {kind: 'fill', parts: ['Хвастун важно называл себя ', {gap: '«'}, 'гением', {gap: '»'}, '.']},
      {kind: 'fill', parts: ['Директор сказал: ', {gap: '«'}, 'Собрание начнётся в три', {gap: '»'}, '.']},
      {kind: 'fill', parts: [{gap: '«'}, 'Осторожно, лёд', {gap: '»'}, ', — предупредил тренер.']},
      {kind: 'fill', parts: ['В журнале ', {gap: '«'}, 'Вокруг света', {gap: '»'}, ' вышла новая статья.']},
      {kind: 'fill', parts: ['Соседка снова назвала кота ', {gap: '«'}, 'разбойником', {gap: '»'}, '.']},
      {kind: 'fill', parts: ['Экскурсовод произнёс: ', {gap: '«'}, 'Перед вами древний замок', {gap: '»'}, '.']},
      {kind: 'fill', parts: [{gap: '«'}, 'Идём домой', {gap: '»'}, ', — сказала бабушка.']},
      {kind: 'fill', parts: ['Мы изучали повесть ', {gap: '«'}, 'Капитанская дочка', {gap: '»'}, '.']}
    ]
  },

  // ───────────── 5. comma-isolation (новая категория) — FILL_TEXT ─────────────
  {
    slug: 'comma-isolation',
    ruName: 'Запятая при обособленных членах',
    postTitle: 'Обособленные члены предложения: когда нужна запятая',
    explanation: [
      'Обособление — это выделение второстепенного члена предложения запятыми, чтобы подчеркнуть его смысловую и интонационную самостоятельность. Здесь — сводная шпаргалка: когда именно нужна запятая, без подробного разбора грамматической природы каждого оборота (та разбирается отдельно в теме «Обособленные члены» блока «Синтаксис»).',
      'Согласованные определения (причастный оборот, прилагательное с зависимыми словами) обособляются, если стоят ПОСЛЕ определяемого слова: «Дом, стоявший на холме, был виден издалека». Обособляются они и тогда, когда стоят ПЕРЕД определяемым словом, но имеют добавочное значение причины или уступки: «Уставший, он всё же дошёл до дома» (= «так как устал»).',
      'Деепричастный оборот и одиночное деепричастие обособляются почти всегда, независимо от места в предложении: «Проверив тетради, учитель ушёл домой». Обстоятельства с предлогами «несмотря на» и «вопреки» тоже обособляются: «Несмотря на усталость, альпинисты продолжили подъём».',
      'Приложения — в том числе со словом «как» в значении причины, распространённые или относящиеся к личному местоимению — обособляются запятыми: «Мой брат, врач по профессии, помог соседям»; «Как настоящий друг, ты всегда поддержишь». Уточняющие члены, конкретизирующие место или время, тоже выделяются запятыми: «Внизу, у самой реки, рос камыш».'
    ],
    coverPrompt:
      'Minimalist editorial photo of a comma-shaped paper cutout resting on lined notebook paper, warm daylight, soft shadows, no readable text',
    cheatSheetLines: [
      'Определение (причастный оборот) ПОСЛЕ определяемого слова — обособляется: «Дом, стоявший на холме, был виден издалека».',
      'Определение ПЕРЕД словом, но со значением причины/уступки — тоже обособляется: «Уставший, он всё же дошёл до дома».',
      'Деепричастный оборот / одиночное деепричастие — обособляется почти всегда: «Проверив тетради, учитель ушёл домой».',
      'Обстоятельство с «несмотря на»/«вопреки» — обособляется: «Несмотря на усталость, альпинисты продолжили подъём».',
      'Приложение (в т.ч. «как» = причина) — обособляется: «Мой брат, врач по профессии, помог соседям»; «Как настоящий друг, ты всегда поддержишь».',
      'Уточняющий член (место/время) — обособляется: «Внизу, у самой реки, рос камыш».'
    ],
    summaryLine:
      'Обособляем запятыми: определение после слова (или перед — с доп. значением), деепричастный оборот, обстоятельства с несмотря на/вопреки, приложения и уточнения.',
    shortTestTitle: 'Обособленные члены: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['Уставший', {gap: ','}, ' он всё же дошёл до дома.']},
      {kind: 'fill', parts: ['Дом', {gap: ','}, ' стоявший на холме', {gap: ','}, ' был виден издалека.']},
      {kind: 'fill', parts: ['Проверив тетради', {gap: ','}, ' учитель ушёл домой.']},
      {kind: 'fill', parts: ['Мы', {gap: ','}, ' несмотря на дождь', {gap: ','}, ' пошли гулять.']},
      {kind: 'fill', parts: ['Внизу', {gap: ','}, ' у самой реки', {gap: ','}, ' рос камыш.']},
      {kind: 'fill', parts: ['Как опытный охотник', {gap: ','}, ' он быстро нашёл след.']}
    ],
    largeTestTitle: 'Обособленные члены: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['Он посмотрел на меня', {gap: ','}, ' прищурив глаза.']},
      {kind: 'fill', parts: ['Утомлённые долгой дорогой', {gap: ','}, ' туристы остановились на привал.']},
      {kind: 'fill', parts: ['Книга', {gap: ','}, ' забытая кем-то на скамейке', {gap: ','}, ' промокла под дождём.']},
      {kind: 'fill', parts: ['Несмотря на усталость', {gap: ','}, ' альпинисты продолжили подъём.']},
      {kind: 'fill', parts: ['Вопреки прогнозу', {gap: ','}, ' погода была солнечной.']},
      {kind: 'fill', parts: ['Мой брат', {gap: ','}, ' врач по профессии', {gap: ','}, ' помог соседям.']},
      {kind: 'fill', parts: ['Ты', {gap: ','}, ' как настоящий друг', {gap: ','}, ' всегда поддержишь.']},
      {kind: 'fill', parts: ['Согревшись у костра', {gap: ','}, ' путники повеселели.']},
      {kind: 'fill', parts: ['Мы решили отдохнуть', {gap: ','}, ' читая книги и слушая музыку.']},
      {kind: 'fill', parts: ['Справа', {gap: ','}, ' у самого леса', {gap: ','}, ' стояла старая мельница.']},
      {kind: 'fill', parts: ['Вечером', {gap: ','}, ' часов в шесть', {gap: ','}, ' мы встретимся у входа.']},
      {kind: 'fill', parts: ['Испуганный внезапным шумом', {gap: ','}, ' заяц бросился в кусты.']}
    ]
  },

  // ───────────── 6. complex-sentence-punctuation (новая категория) — SEQUENCE ─────────────
  {
    slug: 'complex-sentence-punctuation',
    ruName: 'Знаки препинания в сложном предложении (сводно)',
    postTitle: 'Знаки препинания в сложном предложении: единый алгоритм',
    explanation: [
      'Эта тема — синтез: чтобы верно расставить знаки в сложном предложении, нужно сначала понять, к какому ИЗ ТРЁХ ТИПОВ оно относится (сложносочинённое, сложноподчинённое или бессоюзное), потому что у каждого типа своя пунктуационная логика. Алгоритм ниже работает для любого сложного предложения независимо от того, какой конкретно это тип — он самодостаточен и не требует предварительного знания тем «Сложносочинённое предложение», «Сложноподчинённое предложение» или «Бессоюзное сложное предложение» блока «Синтаксис», хотя и опирается на те же понятия.',
      'В сложносочинённом предложении (ССП) части равноправны и соединены сочинительными союзами и, а, но, да, зато — перед союзом ставится запятая: «Мама позвала меня, и я побежал домой». Важное исключение: если у частей есть общий второстепенный член или общее вводное слово, перед одиночным союзом «и» запятая не ставится: «Вечером стемнело и подул холодный ветер» (общее обстоятельство «вечером» — запятой нет).',
      'В сложноподчинённом предложении (СПП) одна часть главная, другая — придаточная, зависимая, присоединяется подчинительным союзом или союзным словом (что, чтобы, если, потому что, который). Запятая ставится на границе частей: «Мы знали, что экзамен будет трудным». Если придаточная часть стоит внутри главной, она выделяется запятыми с двух сторон: «Книга, которую я прочитал, оказалась очень интересной».',
      'В бессоюзном сложном предложении (БСП) части связаны только интонацией, без союзов, — знак выбирается по смыслу между частями. Помогает та же подстановка, что и в темах «Двоеточие»/«Тире»: если можно вставить «и» или части называют одновременные/последовательные события — запятая; если части сильно распространены и менее тесно связаны по смыслу — точка с запятой; если вторая часть — причина или пояснение (=потому что/а именно) — двоеточие; если вторая часть — следствие, противопоставление или резкая смена событий (=поэтому/а/и вдруг) — тире.'
    ],
    coverPrompt:
      'Minimalist editorial illustration of interconnected geometric branches forming a decision tree, muted ink-on-paper palette, no readable text',
    cheatSheetLines: [
      'Шаг 1. Найди все грамматические основы — если она одна, предложение простое.',
      'Шаг 2. Основ несколько — предложение сложное. Ищи союз или союзное слово между частями.',
      'Нет союза (только интонация) -> бессоюзное предложение (БСП).',
      'БСП, причина/пояснение (можно вставить «потому что»/«а именно») -> двоеточие.',
      'БСП, следствие/противопоставление/быстрая смена событий (можно вставить «поэтому»/«а») -> тире.',
      'БСП, части распространены и слабо связаны по смыслу -> точка с запятой.',
      'Союз сочинительный (и, а, но, да, зато) -> сложносочинённое предложение (ССП), запятая перед союзом.',
      'Союз/союзное слово подчинительный (что, чтобы, если, который, потому что) -> сложноподчинённое предложение (СПП), запятая на границе главной и придаточной части.',
      'Придаточное внутри главного (как «который…») — выделяется запятыми с двух сторон.',
      'Повторяющийся союз «и…и…и» — запятая перед каждым «и», начиная со второго.',
      'Искл. в ССП: если у частей общий второстепенный член/вводное слово, перед одиночным «и» запятая не ставится: «Вечером стемнело и подул ветер».'
    ],
    summaryLine: 'Сначала определи тип сложного предложения (ССП/СПП/БСП), затем применяй его собственную пунктуационную логику.',
    shortTestTitle: 'Знаки препинания в сложном предложении: короткая проверка',
    shortTestBlocks: [
      {
        kind: 'sequence',
        steps: [
          'Найди все грамматические основы предложения и посчитай их количество.',
          'Если основа одна — предложение простое; если основ несколько — предложение сложное, переходи дальше.',
          'Проверь, есть ли союз или союзное слово между частями.',
          'Нет союза, части связаны только интонацией — это бессоюзное предложение (БСП): выбирай запятую, точку с запятой, двоеточие или тире по смыслу между частями.',
          'Союз сочинительный (и, а, но, да, зато) и части равноправны — это сложносочинённое предложение (ССП): перед союзом обычно ставь запятую.',
          'Союз подчинительный или союзное слово (что, чтобы, если, который, потому что) — это сложноподчинённое предложение (СПП): отдели придаточную часть запятой от главной.'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Ветер стих но волны ещё бились»: ветер стих; волны бились.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «но» — сочинительный, противительный (ССП).',
          'Расставь знак и получи: «Ветер стих, но волны ещё бились».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Прозвенел звонок и ученики поспешили в класс»: прозвенел звонок; ученики поспешили.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «и» соединяет два предложения с разными основами — сочинительный (ССП).',
          'Расставь знак и получи: «Прозвенел звонок, и ученики поспешили в класс».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Мы знали что экзамен будет трудным»: мы знали; экзамен будет трудным.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «что» — подчинительный, изъяснительный (СПП).',
          'Расставь знак и получи: «Мы знали, что экзамен будет трудным».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Если завтра будет солнечно мы поедем за город»: будет солнечно; мы поедем.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «если» — подчинительный, условия; придаточное стоит перед главным (СПП).',
          'Расставь знак и получи: «Если завтра будет солнечно, мы поедем за город».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Дождь кончился на небе показалось солнце»: дождь кончился; показалось солнце.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, вторая часть поясняет первую (=«и стало видно, что») — БСП, пояснение.',
          'Расставь знак и получи: «Дождь кончился: на небе показалось солнце».'
        ]
      }
    ],
    largeTestTitle: 'Знаки препинания в сложном предложении: большой тест',
    largeTestBlocks: [
      {
        kind: 'sequence',
        steps: [
          'Найди все грамматические основы предложения и посчитай их количество.',
          'Если основа одна — предложение простое; если основ несколько — предложение сложное, переходи дальше.',
          'Проверь, есть ли союз или союзное слово между частями.',
          'Нет союза, части связаны только интонацией — это бессоюзное предложение (БСП): выбирай запятую, точку с запятой, двоеточие или тире по смыслу между частями.',
          'Союз сочинительный (и, а, но, да, зато) и части равноправны — это сложносочинённое предложение (ССП): перед союзом обычно ставь запятую.',
          'Союз подчинительный или союзное слово (что, чтобы, если, который, потому что) — это сложноподчинённое предложение (СПП): отдели придаточную часть запятой от главной.'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Ударил мороз река покрылась льдом»: ударил мороз; река покрылась льдом.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, вторая часть — следствие первой (=«поэтому») — БСП, следствие.',
          'Расставь знак и получи: «Ударил мороз — река покрылась льдом».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Лес рубят щепки летят»: лес рубят; щепки летят.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, части противопоставлены по смыслу — БСП, быстрая смена событий/следствие.',
          'Расставь знак и получи: «Лес рубят — щепки летят».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Я не пошёл гулять начался дождь»: я не пошёл гулять; начался дождь.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, вторая часть — причина первой (=«потому что») — БСП, причина.',
          'Расставь знак и получи: «Я не пошёл гулять: начался дождь».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Задача была сложной зато результат порадовал всех»: задача была сложной; результат порадовал.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «зато» — сочинительный, противительный (ССП).',
          'Расставь знак и получи: «Задача была сложной, зато результат порадовал всех».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Книга которую я прочитал оказалась очень интересной»: книга оказалась интересной; (я) прочитал — придаточное внутри главного.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союзное слово «которую» — подчинительное, придаточное стоит внутри главного и выделяется с двух сторон (СПП).',
          'Расставь знак и получи: «Книга, которую я прочитал, оказалась очень интересной».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Наступила весна и потекли ручьи и запели птицы»: наступила весна; потекли ручьи; запели птицы.',
          'Основ три — предложение сложное.',
          'Определи союз/тип связи: союз «и» повторяется перед каждой частью, кроме первой — запятая перед каждым повторяющимся «и» (ССП).',
          'Расставь знак и получи: «Наступила весна, и потекли ручьи, и запели птицы».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Мы поспешили чтобы успеть на поезд»: мы поспешили; (мы) успеем на поезд.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «чтобы» — подчинительный, цели (СПП).',
          'Расставь знак и получи: «Мы поспешили, чтобы успеть на поезд».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Стало тихо все замолчали»: стало тихо; все замолчали.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, части называют одновременные события (можно вставить «и») — БСП, перечисление.',
          'Расставь знак и получи: «Стало тихо, все замолчали».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Дул сильный ветер дождь лил как из ведра»: дул сильный ветер; дождь лил.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союза нет, части сильно распространены и менее тесно связаны по смыслу — БСП, точка с запятой.',
          'Расставь знак и получи: «Дул сильный ветер; дождь лил как из ведра».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Учитель объяснил тему так что все всё поняли»: учитель объяснил тему; все поняли.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «так что» — подчинительный, следствия (СПП).',
          'Расставь знак и получи: «Учитель объяснил тему так, что все всё поняли».'
        ]
      },
      {
        kind: 'sequence',
        steps: [
          'Найди основы в предложении «Солнце зашло и стало прохладно»: солнце зашло; стало прохладно.',
          'Основ две — предложение сложное.',
          'Определи союз/тип связи: союз «и» соединяет два предложения с разными основами (одна безличная) — сочинительный (ССП).',
          'Расставь знак и получи: «Солнце зашло, и стало прохладно».'
        ]
      }
    ]
  },

  // ───────────── 7. introductory-punctuation (новая категория) — HIGHLIGHT_TEXT ─────────────
  {
    slug: 'introductory-punctuation',
    ruName: 'Пунктуация при вводных словах и обращениях',
    postTitle: 'Вводные слова и обращения: расставляем запятые верно',
    explanation: [
      'Вводные слова (кажется, конечно, к счастью, во-первых, например…) выражают отношение говорящего к сказанному и не являются членами предложения — они всегда выделяются запятыми. Обращения называют того, к кому обращаются, и тоже выделяются запятыми независимо от места в предложении.',
      'Главная трудность — омонимия: некоторые слова совпадают по форме с вводными, но в другом контексте являются полноценными членами предложения или союзом, и тогда запятая не нужна. Было (сказуемое, без запятой): «Мне это давно кажется подозрительным». Стало (вводное, предположение, с запятой): «Кажется, дождь скоро закончится».',
      'Похожая пара — слово «однако». Было (союз в начале предложения, = «но», без запятой): «Однако дождь не переставал». Стало (вводное слово в середине предложения, = «впрочем», запятые с двух сторон): «Дождь, однако, не переставал».',
      'Третья пара — слово «наконец». Было (обстоятельство, = «в конце концов», можно заменить на «напоследок», без запятой): «Он пришёл домой наконец». Стало (вводное слово, = «и вот», с запятой): «Наконец мы можем отдохнуть».',
      'Обращение выделяется запятыми в любом месте предложения — в начале, середине или конце: «Ребята, приготовьтесь к старту»; «Слушай, друг, я всё понял»; «Береги себя, мама».'
    ],
    coverPrompt:
      'Warm editorial photo of a hand-written letter with a small doodle in the margin, soft daylight, cozy desk atmosphere, no readable text',
    cheatSheetLines: [
      'Было: «Мне это давно кажется подозрительным» (сказуемое, без запятой). Стало: «Кажется, дождь скоро закончится» (вводное, запятая).',
      'Было: «Однако дождь не переставал» (союз=но, в начале, без запятой). Стало: «Дождь, однако, не переставал» (вводное=впрочем, запятые с двух сторон).',
      'Было: «Он пришёл домой наконец» (обстоятельство=напоследок, без запятой). Стало: «Наконец мы можем отдохнуть» (вводное=и вот, запятая).',
      'Вводные слова со значением уверенности/неуверенности: конечно, разумеется, возможно, вероятно — всегда в запятых.',
      'Вводные слова порядка мыслей: во-первых, наконец, например, итак — всегда в запятых.',
      'Обращение выделяется запятыми в любом месте предложения: «Ребята, приготовьтесь»; «Слушай, друг, я всё понял»; «Береги себя, мама».'
    ],
    summaryLine:
      'Вводные слова и обращения выделяются запятыми; главная ловушка — омонимы (кажется/однако/наконец), которые без запятой являются членом предложения или союзом.',
    shortTestTitle: 'Вводные слова и обращения: короткая проверка',
    shortTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Кажется дождь скоро закончится', correct: ['Кажется']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Мне это давно кажется подозрительным', correct: []},
      {kind: 'highlight', instruction: 'Выделите вводное слово (оно из двух слов), если оно есть в предложении', text: 'К счастью мы успели на поезд', correct: ['К', 'счастью']},
      {kind: 'highlight', instruction: 'Выделите обращение', text: 'Дети берегите природу', correct: ['Дети']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Во-первых нужно проверить факты', correct: ['Во-первых']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Однако дождь не переставал', correct: []}
    ],
    largeTestTitle: 'Вводные слова и обращения: большой тест',
    largeTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Дождь однако не переставал', correct: ['однако']},
      {kind: 'highlight', instruction: 'Выделите обращение', text: 'Мама скажи мне правду', correct: ['Мама']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Возможно завтра будет солнечно', correct: ['Возможно']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Эта новость возможно многое изменит', correct: ['возможно']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Учитель конечно был прав', correct: ['конечно']},
      {kind: 'highlight', instruction: 'Выделите обращение (оно из двух слов)', text: 'Уважаемые коллеги прошу вашего внимания', correct: ['Уважаемые', 'коллеги']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Например яблоки и груши хорошо хранятся зимой', correct: ['Например']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Врач посоветовал например больше гулять', correct: ['например']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Он пришёл домой наконец', correct: []},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Наконец мы можем отдохнуть', correct: ['Наконец']},
      {kind: 'highlight', instruction: 'Выделите обращение', text: 'Друзья мы всегда будем рядом', correct: ['Друзья']},
      {kind: 'highlight', instruction: 'Выделите вводное слово, если оно есть в предложении', text: 'Разумеется никто не хотел ссориться', correct: ['Разумеется']}
    ]
  }
]

// ───────────────────────── main ─────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}. Run seedUsers.ts first.`)

  const parent = await prisma.category.findUniqueOrThrow({where: {slug: 'punctuation'}})

  const report: {
    categories: {slug: string; id: string; isNew: boolean}[]
    topics: {slug: string; postId?: string; shortTestId?: string; largeTestId?: string; cheatSheetUrl?: string; skipped: boolean}[]
    summaryPdfUrl?: string
  } = {categories: [], topics: []}

  // ── categories ──
  const categoryIds = new Map<string, string>()

  for (const slug of EXISTING_CATEGORY_SLUGS) {
    const cat = await prisma.category.findUniqueOrThrow({where: {slug}})
    categoryIds.set(slug, cat.id)
    report.categories.push({slug, id: cat.id, isNew: false})
  }

  for (const nc of NEW_CATEGORIES) {
    const cat = await upsertCategory(nc.slug, parent.id, 3, nc.translations)
    categoryIds.set(nc.slug, cat.id)
    report.categories.push({slug: nc.slug, id: cat.id, isNew: true})
    console.log(`+ категория ${nc.slug} (${cat.id})`)
  }

  // ── topics ──
  for (const topic of TOPICS) {
    const categoryId = categoryIds.get(topic.slug)
    if (!categoryId) throw new Error(`No category id resolved for topic ${topic.slug}`)

    const existingPost = await prisma.post.findFirst({
      where: {teacherId: teacher.id, categoryId, title: topic.postTitle}
    })
    if (existingPost) {
      console.log(`= пропуск темы ${topic.slug} — пост уже существует (${existingPost.id})`)
      report.topics.push({slug: topic.slug, postId: existingPost.id, skipped: true})
      continue
    }

    console.log(`\n─── ${topic.slug} ───`)

    // тесты — идемпотентно: если тест с этим заголовком в этой категории уже создан
    // предыдущим (прерванным) прогоном, переиспользуем его, не плодим дубль.
    async function findOrCreateTest(title: string, description: string, blocks: unknown[]) {
      const existing = await prisma.test.findFirst({
        where: {teacherId: teacher.id, title, testCategories: {some: {categoryId}}}
      })
      if (existing) return existing
      const test = await prisma.test.create({
        data: {teacherId: teacher.id, title, content: {description, blocks}}
      })
      await prisma.testCategory.create({data: {testId: test.id, categoryId}})
      return test
    }

    const shortBlocks = topic.shortTestBlocks.map(buildTestBlock)
    const largeBlocks = topic.largeTestBlocks.map(buildTestBlock)

    const shortTest = await findOrCreateTest(
      topic.shortTestTitle,
      `Короткая проверка по теме «${topic.ruName}».`,
      shortBlocks
    )
    console.log(`  + короткий тест (${shortBlocks.length} блоков): ${shortTest.id}`)

    const largeTest = await findOrCreateTest(
      topic.largeTestTitle,
      `Большой итоговый тест по теме «${topic.ruName}».`,
      largeBlocks
    )
    console.log(`  + большой тест (${largeBlocks.length} блоков): ${largeTest.id}`)

    // cheat sheet PDF
    const cheatSheetBuffer = await buildCheatSheetPdf(`${topic.ruName} — шпаргалка`, topic.cheatSheetLines)
    const cheatSheetUrl = await uploadBuffer(cheatSheetBuffer, 'russian-course-cheatsheets', 'pdf', teacher.id, 'application/pdf')
    console.log(`  + шпаргалка PDF: ${cheatSheetUrl}`)

    // cover image
    const coverBuffer = await generateCoverImage(topic.coverPrompt)
    const coverUrl = await uploadBuffer(coverBuffer, 'russian-course-images', 'jpg', teacher.id, 'image/jpeg')
    console.log(`  + обложка: ${coverUrl}`)

    // post
    const blocks = [
      textBlock(topic.explanation),
      mediaBlock(coverUrl, `Обложка темы «${topic.ruName}»`),
      testLinkBlock([
        {id: shortTest.id, title: shortTest.title},
        {id: largeTest.id, title: largeTest.title}
      ]),
      fileListBlock([
        {name: `${topic.ruName} — шпаргалка.pdf`, size: cheatSheetBuffer.length, mimeType: 'application/pdf', url: cheatSheetUrl}
      ])
    ]

    const post = await prisma.post.create({
      data: {
        teacherId: teacher.id,
        categoryId,
        title: topic.postTitle,
        visibility: 'PUBLIC',
        content: {blocks},
        mediaUrls: extractMediaUrls(blocks),
        aiTopics: [],
        viewCount: 0
      }
    })
    console.log(`  + пост: ${post.id}`)

    report.topics.push({
      slug: topic.slug,
      postId: post.id,
      shortTestId: shortTest.id,
      largeTestId: largeTest.id,
      cheatSheetUrl,
      skipped: false
    })
  }

  // ── block summary PDF ──
  const summaryBuffer = await buildSummaryPdf(
    'Пунктуация — оглавление блока',
    TOPICS.map((t) => ({name: t.ruName, line: t.summaryLine}))
  )
  const summaryUrl = await uploadBuffer(summaryBuffer, 'russian-course-cheatsheets', 'pdf', teacher.id, 'application/pdf')
  report.summaryPdfUrl = summaryUrl
  console.log(`\n+ сводный PDF блока «Пунктуация»: ${summaryUrl}`)

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
