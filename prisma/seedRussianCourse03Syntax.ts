/**
 * Seed: блок «Синтаксис» курса «Русский язык» (тикет 03, .autopilot/russian-course/).
 * Идемпотентно: категории — upsert по slug; тема пропускается только если и пост,
 * и оба теста уже существуют (findOrCreateTest на уровне темы — см. §9 interfaces.md).
 *
 * Run: npx tsx prisma/seedRussianCourse03Syntax.ts
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
// 'google/nano-banana' — рекомендованная image-модель (velsvisual recommend image --refresh),
// подтверждена рабочей в тикете 01. 'nano-banana-2' не существует в живом каталоге.
const IMAGE_MODEL = 'google/nano-banana'
const COVERS_DIR = path.join(process.cwd(), '.tmp-russian-course-covers-03-syntax')

// ───────────────────────── small id/content helpers ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc03-${Date.now()}-${++_uidCounter}`
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
// (same shape confirmed in ticket 01 by reading InputGapNode.tsx / scoreBlock.tsx).
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

// MatchPairsPayload: {pairs: {id,left,right}[]} — src/shared/types/Tasks/TaskPayload.type.ts:20-22
function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {
    id: uid(),
    type: TaskBlockType.MATCH_PAIRS,
    payload: {pairs: pairs.map((p) => ({id: uid(), left: p.left, right: p.right}))}
  }
}

// HighlightTextPayload: {instruction, tokens: {id,text,isCorrect}[]} — TaskPayload.type.ts:52-61.
// Tokenized by splitting the sentence on spaces; correctTokens lists the exact tokens
// (punctuation included, as they appear after the split) that should be marked isCorrect.
function highlightTextBlock(instruction: string, sentence: string, correctTokens: string[]) {
  const words = sentence.split(' ')
  const correctSet = new Set(correctTokens)
  return {
    id: uid(),
    type: TaskBlockType.HIGHLIGHT_TEXT,
    payload: {
      instruction,
      tokens: words.map((text, i) => ({id: i, text, isCorrect: correctSet.has(text)}))
    }
  }
}

type BlockSpec =
  | {kind: 'choose'; question: string; options: string[]; correct: number}
  | {kind: 'fill'; parts: FillPart[]}
  | {kind: 'match'; pairs: {left: string; right: string}[]}
  | {kind: 'highlight'; instruction: string; sentence: string; correct: string[]}

function buildTestBlock(spec: BlockSpec) {
  switch (spec.kind) {
    case 'choose':
      return chooseBlock(spec.question, spec.options, spec.correct)
    case 'fill':
      return fillTextBlock(spec.parts)
    case 'match':
      return matchPairsBlock(spec.pairs)
    case 'highlight':
      return highlightTextBlock(spec.instruction, spec.sentence, spec.correct)
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

// complex-sentence уже в БД под именем «Сложное предложение» (шире, чем нужно тикету) —
// не менять slug, только сузить перевод до «СПП: виды придаточных» во всех 4 локалях.
const COMPLEX_SENTENCE_TRANSLATIONS = {
  ru: 'Сложноподчинённое предложение: виды придаточных',
  en: 'Complex Sentence: Types of Subordinate Clauses',
  hi: 'मिश्र वाक्य: आश्रित उपवाक्यों के प्रकार',
  zh: '主从复句：从句类型'
}

const NEW_CATEGORIES: {slug: string; translations: Record<'ru' | 'en' | 'hi' | 'zh', string>}[] = [
  {
    slug: 'phrase-connection',
    translations: {
      ru: 'Словосочетание: виды связи',
      en: 'Phrase: Types of Grammatical Connection',
      hi: 'वाक्यांश: व्याकरणिक संबंध के प्रकार',
      zh: '词组：语法连接类型'
    }
  },
  {
    slug: 'one-part-sentence',
    translations: {
      ru: 'Односоставные предложения',
      en: 'One-Part Sentences',
      hi: 'एकल-अंगी वाक्य',
      zh: '单部句'
    }
  },
  {
    slug: 'homogeneous-parts',
    translations: {
      ru: 'Однородные члены предложения',
      en: 'Homogeneous Parts of a Sentence',
      hi: 'वाक्य के सजातीय सदस्य',
      zh: '句子的同类成分'
    }
  },
  {
    slug: 'isolated-members',
    translations: {
      ru: 'Обособленные определения и обстоятельства',
      en: 'Isolated Attributes and Adverbial Modifiers',
      hi: 'पृथक्कृत विशेषण और क्रियाविशेषण वाक्यांश',
      zh: '独立定语和状语'
    }
  },
  {
    slug: 'introductory-words',
    translations: {
      ru: 'Вводные слова, конструкции и обращения',
      en: 'Parenthetical Words, Constructions, and Direct Address',
      hi: 'प्रासंगिक शब्द, निर्माण और संबोधन',
      zh: '插入语、插入结构与称呼语'
    }
  },
  {
    slug: 'compound-sentence',
    translations: {
      ru: 'Сложносочинённое предложение',
      en: 'Compound Sentence',
      hi: 'समानाधिकरण संयुक्त वाक्य',
      zh: '并列复句'
    }
  },
  {
    slug: 'asyndetic-sentence',
    translations: {
      ru: 'Бессоюзное сложное предложение',
      en: 'Asyndetic (Non-Conjunctive) Compound Sentence',
      hi: 'असंयोजक संयुक्त वाक्य',
      zh: '无连词复句'
    }
  },
  {
    slug: 'direct-speech',
    translations: {
      ru: 'Прямая речь, косвенная речь, цитирование',
      en: 'Direct Speech, Reported Speech, and Quotation',
      hi: 'प्रत्यक्ष कथन, अप्रत्यक्ष कथन और उद्धरण',
      zh: '直接引语、间接引语与引用'
    }
  }
]

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
  {
    slug: 'simple-sentence',
    ruName: 'Простое предложение',
    postTitle: 'Простое предложение: главные и второстепенные члены',
    explanation: [
      'Простое предложение имеет одну грамматическую основу — подлежащее и сказуемое (или только один из этих членов, если предложение односоставное). Подлежащее называет предмет речи и отвечает на вопросы кто? что?, сказуемое сообщает, что об этом предмете говорится, и отвечает на вопросы что делает предмет? каков он? что он такое?',
      'Сказуемое бывает трёх типов. Простое глагольное сказуемое (ПГС) выражено одним глаголом в любом наклонении: Дождь идёт весь день. Составное глагольное сказуемое (СГС) состоит из вспомогательного глагола (начать, хотеть, мочь, продолжать и т. п.) и инфинитива: Он начал готовиться к экзамену. Составное именное сказуемое (СИС) состоит из глагола-связки (быть, стать, казаться, являться — в настоящем времени связка часто опускается) и именной части — существительного, прилагательного, причастия: Погода была ясной. Она врач.',
      'Второстепенные члены поясняют главные. Дополнение отвечает на вопросы косвенных падежей (кого? чему? кем? и т. д.) и обозначает объект действия: читаю книгу. Определение отвечает на вопросы какой? чей? и характеризует предмет: интересная книга. Обстоятельство отвечает на вопросы где? когда? как? почему? зачем? и характеризует действие или признак: читаю вечером.'
    ],
    coverPrompt:
      'Minimalist editorial photo of wooden alphabet blocks arranged in a neat row on a desk, soft natural light, calm study atmosphere, no readable text',
    cheatSheetLines: [
      'Грамматическая основа — подлежащее (кто? что?) + сказуемое (что делает? каков?).',
      'ПГС — один глагол: идёт, читает, прочитал.',
      'СГС — вспомогательный глагол (начал, хочет, может) + инфинитив: начал готовиться.',
      'СИС — глагол-связка (быть, стать, казаться; в наст. вр. часто опущена) + именная часть: была ясной, она врач.',
      'Дополнение — вопросы косвенных падежей (кого? чему?): читаю книгу.',
      'Определение — вопросы какой? чей?: интересная книга.',
      'Обстоятельство — вопросы где? когда? как? почему? зачем?: читаю вечером.'
    ],
    summaryLine: 'Грамматическая основа — подлежащее + сказуемое (ПГС/СГС/СИС); второстепенные члены — дополнение, определение, обстоятельство.',
    shortTestTitle: 'Простое предложение: короткая проверка',
    shortTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и сказуемое)', sentence: 'Старый дуб рос у самой дороги.', correct: ['дуб', 'рос']},
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и сказуемое)', sentence: 'Дети весело играли во дворе.', correct: ['Дети', 'играли']},
      {kind: 'choose', question: '«Читаю интересную книгу». Слово «интересную» — это:', options: ['определение', 'дополнение', 'обстоятельство'], correct: 0},
      {kind: 'choose', question: '«Вечером мы гуляли в парке». Слово «вечером» — это:', options: ['подлежащее', 'обстоятельство', 'дополнение'], correct: 1},
      {kind: 'choose', question: '«Она врач» — тип сказуемого:', options: ['составное именное', 'простое глагольное', 'составное глагольное'], correct: 0},
      {kind: 'choose', question: '«Он начал готовиться к экзамену» — тип сказуемого:', options: ['составное глагольное', 'простое глагольное', 'составное именное'], correct: 0}
    ],
    largeTestTitle: 'Простое предложение: большой тест на члены предложения',
    largeTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и сказуемое)', sentence: 'Старый дуб рос у самой дороги.', correct: ['дуб', 'рос']},
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и сказуемое)', sentence: 'Дети весело играли во дворе.', correct: ['Дети', 'играли']},
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и именная часть сказуемого)', sentence: 'Мой брат — врач.', correct: ['брат', 'врач.']},
      {kind: 'highlight', instruction: 'Выделите грамматическую основу (подлежащее и составное сказуемое)', sentence: 'Она начала готовиться к экзамену.', correct: ['Она', 'начала', 'готовиться']},
      {kind: 'choose', question: '«Погода была ясной» — тип сказуемого:', options: ['составное именное', 'простое глагольное', 'составное глагольное'], correct: 0},
      {kind: 'choose', question: '«Дождь идёт весь день» — тип сказуемого:', options: ['простое глагольное', 'составное именное', 'составное глагольное'], correct: 0},
      {kind: 'choose', question: '«Читаю книгу». Слово «книгу» — это:', options: ['дополнение', 'определение', 'обстоятельство'], correct: 0},
      {kind: 'choose', question: 'Подлежащее отвечает на вопросы:', options: ['кто? что?', 'какой? чей?', 'где? когда?'], correct: 0},
      {kind: 'choose', question: 'Дополнение отвечает на вопросы:', options: ['косвенных падежей (кого? чему?)', 'кто? что?', 'где? когда?'], correct: 0},
      {kind: 'choose', question: 'Определение отвечает на вопросы:', options: ['какой? чей?', 'кто? что?', 'где? когда?'], correct: 0},
      {kind: 'choose', question: 'Обстоятельство отвечает на вопросы:', options: ['где? когда? как? почему?', 'какой? чей?', 'кто? что?'], correct: 0},
      {kind: 'choose', question: 'Связка в составном именном сказуемом (быть, стать, казаться) в настоящем времени:', options: ['часто опускается', 'никогда не опускается', 'всегда выражена явно'], correct: 0},
      {kind: 'choose', question: '«Она стала врачом» — тип сказуемого:', options: ['составное именное', 'составное глагольное', 'простое глагольное'], correct: 0}
    ]
  },
  {
    slug: 'complex-sentence',
    ruName: 'Сложноподчинённое предложение: виды придаточных',
    postTitle: 'Сложноподчинённое предложение: виды придаточных',
    explanation: [
      'Сложноподчинённое предложение (СПП) состоит из главной и одной или нескольких придаточных частей, связанных подчинительными союзами (что, чтобы, если, хотя, потому что и др.) или союзными словами (который, где, куда, когда, как и др.). Придаточная часть отвечает на вопрос от главной, и по этому вопросу определяется её тип.',
      'Придаточные определительные отвечают на вопрос какой? и относятся к существительному в главной части, присоединяются союзным словом который (реже — где, куда, когда): Дом, который стоит на холме, виден издалека. Придаточные изъяснительные отвечают на вопросы косвенных падежей (что? о чём? и т. д.) и относятся к глаголу со значением речи, мысли, чувства, присоединяются союзами что, чтобы, будто или союзными словами кто, как, где: Я знаю, что он прав.',
      'Придаточные обстоятельственные отвечают на те же вопросы, что и обстоятельства: места (где? куда? откуда? — где, куда, откуда), времени (когда? как долго? — когда, пока, с тех пор как), причины (почему? — потому что, так как), следствия (что из этого следует? — так что), цели (зачем? — чтобы), условия (при каком условии? — если, раз), уступки (несмотря на что? — хотя, несмотря на то что), сравнения (как? подобно чему? — как, будто, словно) и меры/степени (как? в какой мере? — так что, насколько).'
    ],
    coverPrompt:
      'Abstract editorial illustration of branching tree-like ink lines on textured paper, representing connected clauses, muted tones, no readable text',
    cheatSheetLines: [
      'СПП = главная часть + придаточная, связаны союзом/союзным словом; вопрос от главной части определяет тип придаточного.',
      'Определительное — какой? (относится к сущ.), союзное слово который: Дом, который стоит на холме...',
      'Изъяснительное — вопросы косвенных падежей, относится к глаголу речи/мысли/чувства: Я знаю, что он прав.',
      'Места — где? куда? откуда? Времени — когда? как долго? Причины — почему? Следствия — что из этого следует?',
      'Цели — зачем? (чтобы). Условия — при каком условии? (если). Уступки — несмотря на что? (хотя).',
      'Сравнения — как? подобно чему? (как, будто, словно). Меры/степени — как? в какой мере? (так что, насколько).'
    ],
    summaryLine: 'Тип придаточного определяем по вопросу от главной части: определительное, изъяснительное, обстоятельственные (места/времени/причины/цели/условия/уступки/сравнения).',
    shortTestTitle: 'СПП: виды придаточных — короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'В предложении «Дом, который стоит на холме, виден издалека» придаточное — это:', options: ['определительное', 'изъяснительное', 'причины'], correct: 0},
      {kind: 'choose', question: 'В предложении «Я знаю, что он прав» придаточное — это:', options: ['определительное', 'изъяснительное', 'цели'], correct: 1},
      {kind: 'choose', question: 'В предложении «Мы вышли, когда стемнело» придаточное отвечает на вопрос:', options: ['где?', 'когда?', 'зачем?'], correct: 1},
      {kind: 'choose', question: 'Придаточное времени отвечает на вопросы:', options: ['когда? как долго?', 'какой?', 'зачем?'], correct: 0},
      {kind: 'choose', question: 'В предложении «Он опоздал, потому что проспал» придаточное — это:', options: ['причины', 'следствия', 'условия'], correct: 0},
      {kind: 'choose', question: 'Придаточное цели присоединяется союзом:', options: ['чтобы', 'хотя', 'как'], correct: 0}
    ],
    largeTestTitle: 'СПП: виды придаточных — большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'В предложении «Если пойдёт дождь, мы останемся дома» придаточное — это:', options: ['условия', 'причины', 'уступки'], correct: 0},
      {kind: 'choose', question: 'В предложении «Хотя было холодно, мы пошли гулять» придаточное — это:', options: ['условия', 'уступки', 'сравнения'], correct: 1},
      {kind: 'choose', question: 'В предложении «Он говорил так, будто всё знал заранее» придаточное — это:', options: ['сравнения', 'следствия', 'места'], correct: 0},
      {kind: 'choose', question: 'В предложении «Мороз был так силён, что деревья трещали» придаточное — это:', options: ['меры и степени', 'цели', 'причины'], correct: 0},
      {kind: 'choose', question: 'В предложении «Он устал так, что не мог идти дальше» придаточное — это:', options: ['следствия', 'условия', 'места'], correct: 0},
      {kind: 'choose', question: 'В предложении «Куда глаза глядят, туда и пойдём» придаточное — это:', options: ['места', 'времени', 'цели'], correct: 0},
      {kind: 'choose', question: 'Придаточное определительное присоединяется союзным словом:', options: ['который', 'чтобы', 'если'], correct: 0},
      {kind: 'choose', question: 'Придаточное изъяснительное относится к слову со значением:', options: ['речи, мысли, чувства', 'места', 'времени'], correct: 0},
      {kind: 'choose', question: 'В предложении «Я не знал, где искать книгу» придаточное — это:', options: ['изъяснительное', 'определительное', 'места'], correct: 0},
      {kind: 'choose', question: 'Придаточное уступки отвечает на вопрос:', options: ['несмотря на что?', 'зачем?', 'когда?'], correct: 0},
      {kind: 'choose', question: 'В предложении «Небо потемнело, так что зажгли фонари» придаточное — это:', options: ['следствия', 'причины', 'цели'], correct: 0},
      {kind: 'choose', question: 'Придаточное места присоединяется союзными словами:', options: ['где, куда, откуда', 'что, чтобы', 'если, раз'], correct: 0},
      {kind: 'choose', question: 'В предложении «Всюду, где мы бывали, нас встречали тепло» придаточное — это:', options: ['места', 'определительное', 'времени'], correct: 0},
      {kind: 'choose', question: 'Придаточное сравнения присоединяется союзами:', options: ['как, будто, словно', 'что, чтобы', 'если, раз'], correct: 0}
    ]
  },
  {
    slug: 'phrase-connection',
    ruName: 'Словосочетание: виды связи',
    postTitle: 'Словосочетание: согласование, управление, примыкание',
    explanation: [
      'Словосочетание — это соединение двух и более самостоятельных слов, связанных по смыслу и грамматически, где одно слово главное, а другое зависимое. Не являются словосочетаниями грамматическая основа (подлежащее + сказуемое) и однородные члены, соединённые сочинительной связью. Тип подчинительной связи определяется по тому, как зависимое слово ведёт себя рядом с главным.',
      'Согласование — зависимое слово (обычно прилагательное, причастие, порядковое числительное или местоимение-прилагательное) стоит в том же роде, числе и падеже, что и главное, и меняется вместе с ним: красивый дом -> красивого дома -> красивому дому. Управление — главное слово требует от зависимого (обычно существительного или местоимения) постановки в определённом падеже, и это не меняется при изменении главного слова: читать книгу -> читаю книгу -> читал книгу — зависимое слово всегда в винительном падеже.',
      'Примыкание — зависимое слово неизменяемое (наречие, деепричастие, инфинитив, притяжательное местоимение его/её/их) и связано с главным только по смыслу и порядку слов, без изменения формы: говорить громко, читать сидя, желание учиться, её книга.'
    ],
    coverPrompt: 'Macro photo of two wooden puzzle pieces interlocking on a table, warm light, minimalist composition, no readable text',
    cheatSheetLines: [
      'Словосочетание = главное слово + зависимое, связаны по смыслу и грамматически; основа предложения — не словосочетание.',
      'Согласование — зависимое слово меняется вместе с главным (род/число/падеж): красивый дом -> красивого дома.',
      'Управление — главное слово требует от зависимого постоянного падежа: читать книгу, читаю книгу, читал книгу.',
      'Примыкание — зависимое слово неизменяемое (наречие, деепричастие, инфинитив, его/её/их): говорить громко, желание учиться, её книга.',
      'Проверка: если зависимое слово меняется по падежам вслед за главным — согласование; если падеж зависимого фиксирован — управление; если слово вообще не изменяется — примыкание.'
    ],
    summaryLine: 'Согласование — оба слова меняются вместе; управление — падеж зависимого слова фиксирован; примыкание — зависимое слово неизменяемое.',
    shortTestTitle: 'Словосочетание: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [
        {left: 'красивый сад', right: 'согласование'},
        {left: 'читать книгу', right: 'управление'},
        {left: 'говорить громко', right: 'примыкание'},
        {left: 'моя сестра', right: 'согласование'}
      ]},
      {kind: 'choose', question: '«Красивый сад» — вид связи:', options: ['согласование', 'управление', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Читать книгу» — вид связи:', options: ['управление', 'согласование', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Говорить громко» — вид связи:', options: ['примыкание', 'управление', 'согласование'], correct: 0},
      {kind: 'choose', question: 'При согласовании зависимое слово:', options: ['меняется вместе с главным по роду/числу/падежу', 'всегда стоит в одном и том же падеже', 'не изменяется вообще'], correct: 0},
      {kind: 'choose', question: 'При примыкании зависимое слово:', options: ['неизменяемое (наречие, инфинитив, деепричастие)', 'согласуется в роде и числе', 'управляется падежом'], correct: 0}
    ],
    largeTestTitle: 'Словосочетание: большой тест на виды связи',
    largeTestBlocks: [
      {kind: 'match', pairs: [
        {left: 'красивый сад', right: 'согласование'},
        {left: 'читать книгу', right: 'управление'},
        {left: 'говорить громко', right: 'примыкание'},
        {left: 'моя сестра', right: 'согласование'},
        {left: 'желание путешествовать', right: 'примыкание'},
        {left: 'гордиться сыном', right: 'управление'},
        {left: 'третий этаж', right: 'согласование'},
        {left: 'её книга', right: 'примыкание'}
      ]},
      {kind: 'choose', question: '«Моя сестра» — вид связи:', options: ['согласование', 'управление', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Желание путешествовать» — вид связи:', options: ['примыкание', 'согласование', 'управление'], correct: 0},
      {kind: 'choose', question: '«Гордиться сыном» — вид связи:', options: ['управление', 'согласование', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Её книга» (её — притяжательное местоимение) — вид связи:', options: ['примыкание', 'согласование', 'управление'], correct: 0},
      {kind: 'choose', question: '«Третий этаж» — вид связи:', options: ['согласование', 'управление', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Рассказывать интересно» — вид связи:', options: ['примыкание', 'управление', 'согласование'], correct: 0},
      {kind: 'choose', question: 'При управлении падеж зависимого слова:', options: ['не меняется при изменении главного слова', 'меняется вместе с главным словом', 'определяется только смыслом, без падежа'], correct: 0},
      {kind: 'choose', question: 'Согласование чаще всего выражают:', options: ['прилагательные, причастия, порядковые числительные', 'наречия', 'деепричастия'], correct: 0},
      {kind: 'choose', question: 'Управление чаще всего связывает главное слово с:', options: ['существительным или местоимением в косвенном падеже', 'неизменяемым наречием', 'инфинитивом'], correct: 0},
      {kind: 'choose', question: 'Грамматическая основа предложения (подлежащее + сказуемое):', options: ['словосочетанием не является', 'является словосочетанием с согласованием', 'является словосочетанием с управлением'], correct: 0},
      {kind: 'choose', question: '«Слушать музыку» — вид связи:', options: ['управление', 'согласование', 'примыкание'], correct: 0},
      {kind: 'choose', question: '«Очень интересно» — вид связи:', options: ['примыкание', 'управление', 'согласование'], correct: 0}
    ]
  },
  {
    slug: 'one-part-sentence',
    ruName: 'Односоставные предложения',
    postTitle: 'Односоставные предложения: пять типов',
    explanation: [
      'В односоставном предложении грамматическая основа состоит только из одного главного члена — подлежащего или сказуемого, и предложение при этом остаётся полным и понятным. Различают пять типов односоставных предложений в зависимости от того, каким членом и в какой форме выражена основа.',
      'Назывные предложения имеют только подлежащее, называют предмет или явление без указания на действие: Ночь. Тишина. Определённо-личные предложения имеют сказуемое в форме 1-го или 2-го лица настоящего/будущего времени или повелительного наклонения — деятель ясен из формы глагола: Иду домой. Позвони мне. Неопределённо-личные предложения имеют сказуемое в форме 3-го лица множественного числа настоящего/будущего времени или множественного числа прошедшего времени — деятель неизвестен или неважен: В дверь постучали.',
      'Обобщённо-личные предложения — сказуемое в форме 2-го лица единственного числа или 3-го лица множественного числа, но действие относится к любому лицу, обычно в пословицах: Цыплят по осени считают. Безличные предложения не имеют и не могут иметь подлежащего, обозначают состояние природы, человека, действие без деятеля: Смеркается. Мне нездоровится. Нет времени.'
    ],
    coverPrompt: 'Editorial photo of a single spotlight illuminating an empty stage, moody atmosphere, minimalist composition, no readable text',
    cheatSheetLines: [
      'Назывные — только подлежащее, без действия: Ночь. Тишина.',
      'Определённо-личные — сказуемое 1/2 л. наст./буд. вр. или повелит. накл., деятель ясен из формы: Иду домой. Позвони.',
      'Неопределённо-личные — сказуемое 3 л. мн.ч. наст./буд. или мн.ч. прош. вр., деятель неважен: В дверь постучали.',
      'Обобщённо-личные — действие относится к любому лицу, часто пословицы: Цыплят по осени считают.',
      'Безличные — подлежащего нет и быть не может: Смеркается. Мне нездоровится. Нет времени.'
    ],
    summaryLine: 'Пять типов односоставных: назывные (только подлежащее), определённо-/неопределённо-/обобщённо-личные и безличные (только сказуемое разных форм).',
    shortTestTitle: 'Односоставные предложения: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Предложение «Ночь. Тишина.» — это:', options: ['назывное', 'безличное', 'неопределённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Иду домой» — это:', options: ['определённо-личное', 'безличное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «В дверь постучали» — это:', options: ['неопределённо-личное', 'определённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Смеркается» — это:', options: ['безличное', 'назывное', 'обобщённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Цыплят по осени считают» — это:', options: ['обобщённо-личное', 'неопределённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'В определённо-личном предложении сказуемое стоит в форме:', options: ['1-го или 2-го лица', '3-го лица мн.ч.', 'прошедшего времени'], correct: 0}
    ],
    largeTestTitle: 'Односоставные предложения: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Предложение «Ночь. Тишина.» — это:', options: ['назывное', 'безличное', 'неопределённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Иду домой» — это:', options: ['определённо-личное', 'безличное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «В дверь постучали» — это:', options: ['неопределённо-личное', 'определённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Смеркается» — это:', options: ['безличное', 'назывное', 'обобщённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Цыплят по осени считают» — это:', options: ['обобщённо-личное', 'неопределённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Мне нездоровится» — это:', options: ['безличное', 'определённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Позвони мне вечером» — это:', options: ['определённо-личное', 'безличное', 'неопределённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Без труда не вытащишь и рыбку из пруда» — это:', options: ['обобщённо-личное', 'назывное', 'безличное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Нет времени на разговоры» — это:', options: ['безличное', 'назывное', 'определённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Зимний вечер» — это:', options: ['назывное', 'безличное', 'определённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «Соберите вещи и выходите» — это:', options: ['определённо-личное', 'неопределённо-личное', 'обобщённо-личное'], correct: 0},
      {kind: 'choose', question: 'Предложение «В газетах писали о новом законе» — это:', options: ['неопределённо-личное', 'определённо-личное', 'назывное'], correct: 0},
      {kind: 'choose', question: 'В безличном предложении подлежащее:', options: ['отсутствует и невозможно', 'подразумевается', 'выражено местоимением'], correct: 0},
      {kind: 'choose', question: 'В неопределённо-личном предложении деятель:', options: ['неизвестен или неважен', 'ясен из формы глагола', 'назван существительным'], correct: 0}
    ]
  },
  {
    slug: 'homogeneous-parts',
    ruName: 'Однородные члены предложения',
    postTitle: 'Однородные члены предложения: союзы и знаки препинания',
    explanation: [
      'Однородные члены отвечают на один и тот же вопрос, относятся к одному и тому же слову и связаны сочинительной связью — перечислением или союзами. Между собой они равноправны и не зависят друг от друга.',
      'Соединительные союзы (и, да в значении и, ни...ни) показывают, что действия или признаки происходят одновременно или последовательно — запятая перед одиночным и не ставится: Он читал и писал. При повторяющемся союзе запятая ставится между всеми однородными членами: Он читал, и писал, и рисовал. Разделительные союзы (или, либо, то...то, не то...не то) показывают чередование или взаимоисключение — при повторении тоже требуют запятых: То дождь, то снег. Противительные союзы (а, но, да в значении но, зато, однако) показывают противопоставление — запятая перед ними ставится всегда: Он не читал, а слушал.',
      'Частая ошибка — пропуск запятой перед союзами а и но: их путают с соединительными и не ставят знак. Запятая перед а/но ставится всегда, даже если союз одиночный. Если перед однородными членами стоит обобщающее слово, после него ставится двоеточие: В саду росли цветы: розы, тюльпаны, нарциссы. Если обобщающее слово стоит после однородных членов, перед ним ставится тире: Розы, тюльпаны, нарциссы — всё это росло в саду.'
    ],
    coverPrompt: 'Flat lay photo of a row of identical pencils arranged in parallel on lined paper, soft daylight, no readable text',
    cheatSheetLines: [
      'Однородные члены отвечают на один вопрос, относятся к одному слову, равноправны между собой.',
      'Одиночный союз и/или/либо — запятая НЕ ставится: Он читал и писал.',
      'Повторяющийся союз (и...и, или...или, то...то) — запятая между всеми членами: Он читал, и писал, и рисовал.',
      'Противительные союзы а, но, да(=но), зато — запятая ставится ВСЕГДА, даже если союз одиночный.',
      'Частая ошибка — пропуск запятой перед а/но: её путают с соединительными союзами.',
      'Обобщающее слово перед однородными членами — двоеточие: цветы: розы, тюльпаны. После — тире: розы, тюльпаны — цветы.'
    ],
    summaryLine: 'Запятая между однородными по союзу: не ставится при одиночном и/или, ставится при повторе и всегда перед а/но; обобщающее слово — двоеточие/тире.',
    shortTestTitle: 'Однородные члены: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['Он не читал', {gap: ','}, ' а слушал.']},
      {kind: 'fill', parts: ['В саду росли цветы', {gap: ':'}, ' розы, тюльпаны, нарциссы.']},
      {kind: 'fill', parts: ['Розы, тюльпаны, нарциссы', {gap: '—'}, ' всё это росло в саду.']},
      {kind: 'fill', parts: ['Он читал', {gap: ','}, ' и писал, и рисовал.']},
      {kind: 'fill', parts: ['То снег', {gap: ','}, ' то дождь шёл весь день.']},
      {kind: 'highlight', instruction: 'Выделите однородные члены предложения', sentence: 'В саду росли розы, тюльпаны и нарциссы.', correct: ['розы,', 'тюльпаны', 'нарциссы.']}
    ],
    largeTestTitle: 'Однородные члены: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['Он не спорил', {gap: ','}, ' а соглашался.']},
      {kind: 'fill', parts: ['На столе лежали книги', {gap: ':'}, ' учебники, тетради, словари.']},
      {kind: 'fill', parts: ['Учебники, тетради, словари', {gap: '—'}, ' всё лежало на столе.']},
      {kind: 'fill', parts: ['Мы гуляли', {gap: ','}, ' и читали, и разговаривали.']},
      {kind: 'fill', parts: ['Не то ветер выл', {gap: ','}, ' не то кто-то стонал.']},
      {kind: 'fill', parts: ['Он не обиделся', {gap: ','}, ' а рассмеялся.']},
      {kind: 'fill', parts: ['Она купила яблоки', {gap: ','}, ' груши, сливы.']},
      {kind: 'fill', parts: ['Друзья пришли не с пустыми руками', {gap: ','}, ' а с подарками.']},
      {kind: 'highlight', instruction: 'Выделите однородные члены предложения', sentence: 'Дети рисовали, пели и танцевали на празднике.', correct: ['рисовали,', 'пели', 'танцевали']},
      {kind: 'highlight', instruction: 'Выделите однородные члены предложения', sentence: 'На выставке были картины, скульптуры и фотографии.', correct: ['картины,', 'скульптуры', 'фотографии.']},
      {kind: 'highlight', instruction: 'Выделите однородные члены предложения', sentence: 'Мальчик был весёлым, добрым и отзывчивым.', correct: ['весёлым,', 'добрым,', 'отзывчивым.']},
      {kind: 'highlight', instruction: 'Выделите однородные члены предложения', sentence: 'Мы купили хлеб, молоко и масло.', correct: ['хлеб,', 'молоко', 'масло.']},
      {kind: 'choose', question: 'Однородные члены отвечают:', options: ['на один и тот же вопрос и относятся к одному слову', 'на разные вопросы', 'к разным словам в предложении'], correct: 0},
      {kind: 'choose', question: 'Перед повторяющимся союзом и (и...и...) запятая между однородными членами:', options: ['ставится', 'не ставится', 'ставится только один раз'], correct: 0}
    ]
  },
  {
    slug: 'isolated-members',
    ruName: 'Обособленные определения и обстоятельства',
    postTitle: 'Обособленные определения и обстоятельства: причастный и деепричастный обороты',
    explanation: [
      'Обособление — это выделение второстепенного члена запятыми (реже — тире), чтобы подчеркнуть его смысловую самостоятельность. Чаще всего обособляются причастные и деепричастные обороты.',
      'Причастный оборот — причастие с зависимыми словами — обособляется, если стоит после определяемого существительного: Книга, лежащая на столе, была открыта. Если оборот стоит перед определяемым словом, он, как правило, не обособляется: Лежащая на столе книга была открыта. Причастный оборот обособляется независимо от места, если относится к личному местоимению (Уставший, он сел отдохнуть) или имеет добавочное значение причины/уступки (Испуганные грозой, дети спрятались в доме).',
      'Деепричастный оборот — деепричастие с зависимыми словами — обособляется почти всегда, независимо от места в предложении: Возвращаясь домой, он думал о разговоре. Он шёл, размышляя о будущем. Одиночное деепричастие тоже обособляется, если сохраняет значение добавочного действия: Мальчик, смеясь, убежал. Не обособляются деепричастия, ставшие наречиями или входящие в устойчивые обороты: бежал сломя голову, работать спустя рукава.'
    ],
    coverPrompt: 'Editorial photo of a comma-shaped paper cutout resting beside an open notebook, warm light, minimalist composition, no readable text',
    cheatSheetLines: [
      'Причастный оборот после определяемого слова — обособляется: Книга, лежащая на столе, ...',
      'Причастный оборот перед определяемым словом — обычно НЕ обособляется: Лежащая на столе книга...',
      'Причастный оборот обособляется всегда при личном местоимении или значении причины/уступки.',
      'Деепричастный оборот обособляется почти всегда, независимо от места: Возвращаясь домой, он думал...',
      'Одиночное деепричастие обособляется, если сохраняет значение добавочного действия: Мальчик, смеясь, убежал.',
      'Устойчивые обороты-фразеологизмы с деепричастием НЕ обособляются: бежал сломя голову, работать спустя рукава.'
    ],
    summaryLine: 'Причастный оборот — обособляем после определяемого слова; деепричастный — почти всегда, кроме фразеологизмов.',
    shortTestTitle: 'Обособленные члены: короткая проверка',
    shortTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот', sentence: 'Книга, лежащая на столе, была открыта.', correct: ['лежащая', 'на', 'столе,']},
      {kind: 'highlight', instruction: 'Выделите обособленный деепричастный оборот', sentence: 'Возвращаясь домой, он думал о разговоре.', correct: ['Возвращаясь', 'домой,']},
      {kind: 'highlight', instruction: 'Выделите обособленное одиночное деепричастие', sentence: 'Мальчик, смеясь, убежал.', correct: ['смеясь,']},
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот', sentence: 'Испуганные грозой, дети спрятались в доме.', correct: ['Испуганные', 'грозой,']},
      {kind: 'choose', question: 'Причастный оборот после определяемого слова:', options: ['обособляется', 'не обособляется', 'обособляется только в вопросе'], correct: 0},
      {kind: 'choose', question: 'Деепричастный оборот в предложении обособляется:', options: ['почти всегда, независимо от места', 'только после определяемого слова', 'только перед определяемым словом'], correct: 0}
    ],
    largeTestTitle: 'Обособленные члены: большой тест',
    largeTestBlocks: [
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот', sentence: 'Книга, лежащая на столе, была открыта.', correct: ['лежащая', 'на', 'столе,']},
      {kind: 'highlight', instruction: 'Выделите обособленный деепричастный оборот', sentence: 'Возвращаясь домой, он думал о разговоре.', correct: ['Возвращаясь', 'домой,']},
      {kind: 'highlight', instruction: 'Выделите обособленное одиночное деепричастие', sentence: 'Мальчик, смеясь, убежал.', correct: ['смеясь,']},
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот', sentence: 'Испуганные грозой, дети спрятались в доме.', correct: ['Испуганные', 'грозой,']},
      {kind: 'highlight', instruction: 'Выделите обособленный деепричастный оборот', sentence: 'Он шёл, размышляя о будущем.', correct: ['размышляя', 'о', 'будущем.']},
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот при личном местоимении', sentence: 'Уставший, он сел отдохнуть.', correct: ['Уставший,']},
      {kind: 'highlight', instruction: 'Выделите обособленный причастный оборот', sentence: 'Дом, стоящий на краю деревни, был очень старым.', correct: ['стоящий', 'на', 'краю', 'деревни,']},
      {kind: 'choose', question: 'Причастный оборот перед определяемым словом обычно:', options: ['не обособляется', 'обособляется', 'обособляется только с местоимением'], correct: 0},
      {kind: 'choose', question: '«Бежал сломя голову» — обособляется ли деепричастие «сломя голову»?', options: ['нет, это фразеологизм', 'да, всегда', 'да, если после сказуемого'], correct: 0},
      {kind: 'choose', question: 'Причастный оборот обособляется независимо от места, если относится к:', options: ['личному местоимению', 'существительному в начале предложения', 'числительному'], correct: 0},
      {kind: 'choose', question: '«Мальчик, смеясь, убежал» — одиночное деепричастие «смеясь»:', options: ['обособляется, сохраняет значение добавочного действия', 'не обособляется', 'обособляется только в начале предложения'], correct: 0},
      {kind: 'choose', question: 'Причастный оборот после определяемого слова:', options: ['обособляется', 'не обособляется', 'обособляется только в вопросе'], correct: 0},
      {kind: 'choose', question: 'Деепричастный оборот в предложении обособляется:', options: ['почти всегда, независимо от места', 'только после определяемого слова', 'только перед определяемым словом'], correct: 0}
    ]
  },
  {
    slug: 'introductory-words',
    ruName: 'Вводные слова, конструкции и обращения',
    postTitle: 'Вводные слова, конструкции и обращения',
    explanation: [
      'Вводные слова и конструкции выражают отношение говорящего к высказыванию (уверенность, сомнение, эмоцию, источник сообщения, порядок мыслей) и грамматически не связаны с остальным предложением — не являются его членом, к ним нельзя задать вопрос от других слов. На письме они выделяются запятыми: К счастью, дождь закончился. Он, кажется, устал.',
      'Проверить, вводное ли слово, можно, попробовав убрать его из предложения: если смысл грамматической структуры не пострадает (потеряется только оттенок отношения), слово вводное. Частые вводные слова: конечно, безусловно, кажется, наверное, к счастью, к сожалению, во-первых, итак, например, по-моему, значит, следовательно.',
      'Некоторые слова омонимичны — бывают то вводными, то членами предложения, и это меняет пунктуацию. Однако в начале предложения или части (перед подлежащим) чаще всего союз, равный по смыслу но, — запятая перед ним не ставится, а сам оборот не обособляется: Однако дождь не прекращался. В середине предложения однако — вводное слово, обособляется: Дождь, однако, не прекращался. Кажется бывает вводным (Он, кажется, устал — можно убрать) или сказуемым (Мне всё кажется странным — нельзя убрать, это грамматическая основа). Обращения не являются членами предложения и всегда выделяются запятыми: Мама, посмотри сюда! Дорогие друзья, начинаем урок.'
    ],
    coverPrompt: 'Editorial still life of a vintage rotary phone next to an open notebook, symbolizing speech and commentary, warm sepia tones, no readable text',
    cheatSheetLines: [
      'Вводные слова не являются членом предложения, к ним нельзя задать вопрос, выделяются запятыми.',
      'Проверка: убрать слово из предложения — если смысл структуры не изменился, слово вводное.',
      'Частые вводные: конечно, кажется, наверное, к счастью, к сожалению, во-первых, например, значит, следовательно.',
      'Однако в начале предложения = союз (=но), запятая после не ставится: Однако дождь не прекращался.',
      'Однако в середине предложения = вводное слово, обособляется: Дождь, однако, не прекращался.',
      'Кажется — вводное (можно убрать) или сказуемое (нельзя убрать): Он, кажется, устал / Мне всё кажется странным.',
      'Обращения не являются членом предложения, всегда выделяются запятыми: Мама, посмотри сюда!'
    ],
    summaryLine: 'Вводное слово можно убрать без потери грамматической структуры; омонимичные случаи (однако, кажется) проверяем по месту/возможности убрать; обращения всегда с запятыми.',
    shortTestTitle: 'Вводные слова и обращения: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: '«К счастью, дождь закончился». Слово «к счастью» — это:', options: ['вводное слово', 'дополнение', 'обстоятельство'], correct: 0},
      {kind: 'choose', question: '«Он, кажется, устал». Слово «кажется» — это:', options: ['вводное слово', 'сказуемое', 'дополнение'], correct: 0},
      {kind: 'choose', question: '«Мне всё кажется странным». Слово «кажется» — это:', options: ['сказуемое', 'вводное слово', 'обращение'], correct: 0},
      {kind: 'choose', question: '«Однако дождь не прекращался» (в начале предложения). «Однако» — это:', options: ['союз (=но)', 'вводное слово', 'обращение'], correct: 0},
      {kind: 'choose', question: '«Дождь, однако, не прекращался» (в середине). «Однако» — это:', options: ['вводное слово', 'союз', 'дополнение'], correct: 0},
      {kind: 'choose', question: '«Мама, посмотри сюда!» Слово «мама» — это:', options: ['обращение', 'подлежащее', 'вводное слово'], correct: 0}
    ],
    largeTestTitle: 'Вводные слова и обращения: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: '«К счастью, дождь закончился». Слово «к счастью» — это:', options: ['вводное слово', 'дополнение', 'обстоятельство'], correct: 0},
      {kind: 'choose', question: '«Он, кажется, устал». Слово «кажется» — это:', options: ['вводное слово', 'сказуемое', 'дополнение'], correct: 0},
      {kind: 'choose', question: '«Мне всё кажется странным». Слово «кажется» — это:', options: ['сказуемое', 'вводное слово', 'обращение'], correct: 0},
      {kind: 'choose', question: '«Однако дождь не прекращался» (в начале предложения). «Однако» — это:', options: ['союз (=но)', 'вводное слово', 'обращение'], correct: 0},
      {kind: 'choose', question: '«Дождь, однако, не прекращался» (в середине). «Однако» — это:', options: ['вводное слово', 'союз', 'дополнение'], correct: 0},
      {kind: 'choose', question: '«Мама, посмотри сюда!» Слово «мама» — это:', options: ['обращение', 'подлежащее', 'вводное слово'], correct: 0},
      {kind: 'choose', question: 'Чтобы проверить, вводное ли слово, нужно:', options: ['попробовать убрать его из предложения', 'поставить вопрос от сказуемого', 'посмотреть на его место в предложении'], correct: 0},
      {kind: 'choose', question: '«Во-первых, нужно всё проверить». «Во-первых» — это:', options: ['вводное слово', 'обстоятельство', 'дополнение'], correct: 0},
      {kind: 'choose', question: '«По-моему, он прав». «По-моему» — это:', options: ['вводное слово', 'определение', 'сказуемое'], correct: 0},
      {kind: 'choose', question: '«Дорогие друзья, начинаем урок». «Дорогие друзья» — это:', options: ['обращение', 'подлежащее', 'определение'], correct: 0},
      {kind: 'choose', question: 'Обращение является членом предложения?', options: ['нет, не является', 'да, подлежащим', 'да, дополнением'], correct: 0},
      {kind: 'choose', question: '«Итак, подведём итоги». «Итак» — это:', options: ['вводное слово', 'союз', 'обстоятельство'], correct: 0},
      {kind: 'choose', question: '«Он, безусловно, прав». «Безусловно» — это:', options: ['вводное слово', 'наречие-обстоятельство', 'дополнение'], correct: 0},
      {kind: 'choose', question: 'Вводные слова на письме выделяются:', options: ['запятыми', 'тире', 'двоеточием'], correct: 0}
    ]
  },
  {
    slug: 'compound-sentence',
    ruName: 'Сложносочинённое предложение',
    postTitle: 'Сложносочинённое предложение: союзы и смысловые отношения',
    explanation: [
      'Сложносочинённое предложение (ССП) состоит из двух и более равноправных, независимых друг от друга частей, соединённых сочинительными союзами. В отличие от СПП, ни одна часть ССП не зависит от другой, и от одной части к другой нельзя задать вопрос.',
      'Соединительные союзы (и, да в значении и, ни...ни, тоже, также) показывают, что события происходят одновременно или следуют друг за другом: Солнце село, и на землю опустились сумерки. Разделительные союзы (или, либо, то...то, не то...не то) показывают, что события чередуются или взаимно исключают друг друга: То светило солнце, то шёл дождь. Противительные союзы (а, но, да в значении но, зато, однако) показывают противопоставление одной части другой: Он спешил, но опоздал.',
      'Между частями ССП обычно ставится запятая перед сочинительным союзом. Запятая не ставится, если части имеют общий второстепенный член или общее вводное слово и соединены одиночным союзом и: К вечеру потеплело и пошёл дождь (общее обстоятельство «к вечеру»). Запятая также не ставится в общевопросительном или общевосклицательном предложении с одиночным и.'
    ],
    coverPrompt: 'Abstract photo of two intertwined ropes of equal length on a wooden surface, symbolizing equal connected parts, soft light, no readable text',
    cheatSheetLines: [
      'ССП — равноправные части, соединены сочинительным союзом, друг от друга не зависят.',
      'Соединительные (и, да=и, тоже, также) — одновременность/последовательность: Солнце село, и стемнело.',
      'Разделительные (или, либо, то...то, не то...не то) — чередование: То светило солнце, то шёл дождь.',
      'Противительные (а, но, да=но, зато, однако) — противопоставление: Он спешил, но опоздал.',
      'Запятая перед союзом — по умолчанию ставится между частями ССП.',
      'Запятая НЕ ставится при общем второстепенном члене/вводном слове с одиночным и: К вечеру потеплело и пошёл дождь.'
    ],
    summaryLine: 'ССП соединяет равноправные части союзами по значению (соединительные/разделительные/противительные); запятая перед союзом, кроме случая общего члена с одиночным и.',
    shortTestTitle: 'ССП: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [
        {left: 'и', right: 'соединительный'},
        {left: 'тоже', right: 'соединительный'},
        {left: 'или', right: 'разделительный'},
        {left: 'то...то', right: 'разделительный'}
      ]},
      {kind: 'choose', question: '«Солнце село, и на землю опустились сумерки» — отношение между частями:', options: ['соединительное (одновременность/последовательность)', 'разделительное', 'противительное'], correct: 0},
      {kind: 'choose', question: '«То светило солнце, то шёл дождь» — отношение между частями:', options: ['разделительное (чередование)', 'соединительное', 'противительное'], correct: 0},
      {kind: 'choose', question: '«Он спешил, но опоздал» — отношение между частями:', options: ['противительное', 'соединительное', 'разделительное'], correct: 0},
      {kind: 'choose', question: 'Перед союзом а в ССП запятая:', options: ['ставится', 'не ставится', 'ставится только иногда'], correct: 0},
      {kind: 'choose', question: 'В ССП части предложения:', options: ['равноправны, не зависят друг от друга', 'одна часть зависит от другой', 'связаны подчинительным союзом'], correct: 0}
    ],
    largeTestTitle: 'ССП: большой тест',
    largeTestBlocks: [
      {kind: 'match', pairs: [
        {left: 'и', right: 'соединительный'},
        {left: 'тоже', right: 'соединительный'},
        {left: 'или', right: 'разделительный'},
        {left: 'то...то', right: 'разделительный'},
        {left: 'а', right: 'противительный'},
        {left: 'зато', right: 'противительный'},
        {left: 'также', right: 'соединительный'},
        {left: 'не то...не то', right: 'разделительный'}
      ]},
      {kind: 'choose', question: '«К вечеру потеплело и пошёл дождь» (общее обстоятельство «к вечеру», одиночный союз и) — запятая перед и:', options: ['не ставится', 'ставится', 'ставится всегда'], correct: 0},
      {kind: 'choose', question: '«Не то дождь идёт, не то снег» — союз показывает:', options: ['чередование, взаимоисключение', 'одновременность', 'противопоставление'], correct: 0},
      {kind: 'choose', question: 'Союз зато выражает отношение:', options: ['противительное', 'соединительное', 'разделительное'], correct: 0},
      {kind: 'choose', question: 'Союз тоже выражает отношение:', options: ['соединительное', 'разделительное', 'противительное'], correct: 0},
      {kind: 'choose', question: '«Дождь кончился, и выглянуло солнце» — вид союза:', options: ['соединительный', 'разделительный', 'противительный'], correct: 0},
      {kind: 'choose', question: 'От одной части ССП к другой можно задать вопрос?', options: ['нет, части равноправны', 'да, как в СПП', 'иногда, если есть общий член'], correct: 0},
      {kind: 'choose', question: 'Союз однако в ССП обычно выражает:', options: ['противопоставление', 'присоединение', 'условие'], correct: 0},
      {kind: 'choose', question: 'СПП отличается от ССП тем, что:', options: ['в СПП одна часть зависит от другой, в ССП части равноправны', 'в ССП всегда есть придаточное', 'СПП не содержит союзов'], correct: 0}
    ]
  },
  {
    slug: 'asyndetic-sentence',
    ruName: 'Бессоюзное сложное предложение',
    postTitle: 'Бессоюзное сложное предложение: как выбрать знак препинания',
    explanation: [
      'В бессоюзном сложном предложении (БСП) части соединяются не союзами, а только интонацией и по смыслу. Знак препинания между частями зависит от смыслового отношения между ними, и чтобы его выбрать, нужно определить, что можно мысленно вставить между частями.',
      'Запятая ставится, если части перечисляют одновременные или последовательные события (можно вставить и): Дождь стучал по крыше, ветер гнул деревья. Точка с запятой ставится, если части менее тесно связаны по смыслу и уже осложнены собственными знаками препинания: Лес, окутанный туманом, молчал; где-то далеко, за рекой, куковала кукушка.',
      'Двоеточие ставится, если вторая часть поясняет первую (можно вставить а именно) или раскрывает причину того, о чём говорится в первой части (можно вставить потому что): Я знаю: он не подведёт. Тире ставится, если части противопоставлены (можно вставить а/но), означают быструю смену событий; если вторая часть — вывод или следствие (можно вставить поэтому): Ударил мороз — река встала; если первая часть — условие или время (можно вставить если/когда): Любишь кататься — люби и саночки возить.'
    ],
    coverPrompt: 'Minimalist photo of scattered punctuation-shaped paper cutouts (comma, colon, dash) on a desk, soft light, no readable text',
    cheatSheetLines: [
      'БСП — части связаны только интонацией, без союзов; знак зависит от смыслового отношения между ними.',
      'Запятая — перечисление одновременных/последовательных событий (можно вставить и): Дождь стучал, ветер гнул деревья.',
      'Точка с запятой — части менее тесно связаны, уже есть свои знаки препинания внутри.',
      'Двоеточие — пояснение (=а именно) или причина (=потому что): Я знаю: он не подведёт.',
      'Тире — противопоставление (=а/но), быстрая смена событий, вывод/следствие (=поэтому) или условие/время (=если/когда).',
      'Алгоритм: мысленно вставить союз — какой подходит по смыслу, такой знак и соответствует (и -> запятая, потому что/а именно -> двоеточие, а/но/поэтому/если -> тире).'
    ],
    summaryLine: 'Знак в БСП выбираем по смысловому отношению: запятая — перечисление, двоеточие — пояснение/причина, тире — противопоставление/следствие/условие.',
    shortTestTitle: 'БСП: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['Дождь стучал по крыше', {gap: ','}, ' ветер гнул деревья.']},
      {kind: 'fill', parts: ['Я знаю', {gap: ':'}, ' он не подведёт.']},
      {kind: 'fill', parts: ['Ударил мороз', {gap: '—'}, ' река встала.']},
      {kind: 'fill', parts: ['Любишь кататься', {gap: '—'}, ' люби и саночки возить.']},
      {kind: 'fill', parts: ['Лес молчал', {gap: ';'}, ' где-то далеко куковала кукушка.']},
      {kind: 'choose', question: 'В БСП части соединяются:', options: ['только интонацией, без союзов', 'сочинительными союзами', 'подчинительными союзами'], correct: 0}
    ],
    largeTestTitle: 'БСП: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['Погода испортилась', {gap: ','}, ' небо потемнело.']},
      {kind: 'fill', parts: ['Он не пришёл', {gap: ':'}, ' заболел.']},
      {kind: 'fill', parts: ['Наступила весна', {gap: '—'}, ' прилетели скворцы.']},
      {kind: 'fill', parts: ['Слово не воробей', {gap: '—'}, ' вылетит, не поймаешь.']},
      {kind: 'fill', parts: ['Лес был густой', {gap: ';'}, ' в нём легко было заблудиться, особенно вечером.']},
      {kind: 'fill', parts: ['Собака залаяла', {gap: ','}, ' кошка спряталась под крыльцо.']},
      {kind: 'fill', parts: ['Я выглянул в окно', {gap: ':'}, ' на улице шёл снег.']},
      {kind: 'fill', parts: ['Поработаешь до пота', {gap: '—'}, ' пообедаешь в охоту.']},
      {kind: 'fill', parts: ['Ветер стих', {gap: ','}, ' дождь прекратился.']},
      {kind: 'fill', parts: ['Сад был большой', {gap: ';'}, ' в нём росли яблони, груши и вишни, посаженные ещё дедом.']},
      {kind: 'choose', question: 'Точка с запятой в БСП ставится, если части:', options: ['менее тесно связаны и уже осложнены своими знаками препинания', 'означают быструю смену событий', 'означают условие'], correct: 0},
      {kind: 'choose', question: 'Двоеточие в БСП можно заменить союзом:', options: ['потому что / а именно', 'и', 'но'], correct: 0},
      {kind: 'choose', question: 'Тире в БСП можно заменить союзом:', options: ['а, но, поэтому, если', 'и', 'что'], correct: 0},
      {kind: 'choose', question: 'Запятая в БСП ставится, если части:', options: ['перечисляют одновременные или последовательные события', 'противопоставлены', 'являются выводом'], correct: 0}
    ]
  },
  {
    slug: 'direct-speech',
    ruName: 'Прямая речь, косвенная речь, цитирование',
    postTitle: 'Прямая речь, косвенная речь и цитирование',
    explanation: [
      'Прямая речь — это дословно переданные слова говорящего, оформленные как отдельное предложение и сопровождаемые словами автора. Есть три основные схемы пунктуации в зависимости от положения слов автора.',
      'Если слова автора стоят перед прямой речью: А: «П». — Мама сказала: «Скоро будем ужинать». Если слова автора стоят после прямой речи: «П», — а. — «Скоро будем ужинать», — сказала мама. Если слова автора разрывают прямую речь: «П, — а, — п» (одно предложение) или «П, — а. — П» (два предложения) — «Скоро, — сказала мама, — будем ужинать» и «Уже поздно, — сказала мама. — Пора спать».',
      'Косвенная речь передаёт содержание чужих слов не дословно, оформляется как придаточное изъяснительное предложение с союзами что, чтобы, ли и не берётся в кавычки. Личные и притяжательные местоимения при переводе прямой речи в косвенную меняются с позиции говорящего на позицию автора: Мама сказала: «Я приду поздно» -> Мама сказала, что она придёт поздно. Побуждение передаётся союзом чтобы: Он попросил: «Помоги мне» -> Он попросил, чтобы ему помогли. Вопрос — союзом ли или вопросительным словом, без вопросительного знака: Она спросила: «Который час?» -> Она спросила, который час. Цитата, встроенная в текст как часть предложения, оформляется в кавычках, но без двоеточия и заглавной буквы внутри.'
    ],
    coverPrompt: 'Editorial photo of an open book with a speech-bubble-shaped paper cutout resting on the page, warm light, no readable text',
    cheatSheetLines: [
      'А: «П». — слова автора перед прямой речью: Мама сказала: «Скоро будем ужинать».',
      '«П», — а. — слова автора после прямой речи: «Скоро будем ужинать», — сказала мама.',
      '«П, — а, — п». — слова автора разрывают одно предложение: «Скоро, — сказала мама, — будем ужинать».',
      '«П, — а. — П». — слова автора разрывают два предложения: «Уже поздно, — сказала мама. — Пора спать».',
      'Косвенная речь — придаточное изъяснительное без кавычек: что/чтобы/ли; местоимения меняются на позицию автора.',
      'Побуждение -> чтобы (Помоги мне -> чтобы ему помогли). Вопрос -> ли/вопросит. слово, без «?» (Который час? -> который час).',
      'Цитата в составе предложения — в кавычках, без двоеточия и заглавной буквы внутри: писал, что «гений и злодейство...».'
    ],
    summaryLine: 'Прямая речь — по трём пунктуационным схемам А:«П»/«П»,-а/«П,-а,-п»; косвенная — придаточное с что/чтобы/ли, местоимения меняются на позицию автора.',
    shortTestTitle: 'Прямая и косвенная речь: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['Мама сказала', {gap: ':'}, ' «Скоро будем ужинать».']},
      {kind: 'fill', parts: ['«Скоро будем ужинать»', {gap: ','}, ' — сказала мама.']},
      {kind: 'fill', parts: ['Мама сказала, что', {gap: ' она'}, ' придёт поздно.']},
      {kind: 'fill', parts: ['Он попросил, чтобы', {gap: ' ему'}, ' помогли.']},
      {kind: 'fill', parts: ['Она спросила', {gap: ','}, ' который час.']},
      {kind: 'fill', parts: ['«Уже поздно', {gap: ','}, ' — сказала мама. — Пора спать».']}
    ],
    largeTestTitle: 'Прямая и косвенная речь: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['Мама сказала', {gap: ':'}, ' «Скоро будем ужинать».']},
      {kind: 'fill', parts: ['«Скоро будем ужинать»', {gap: ','}, ' — сказала мама.']},
      {kind: 'fill', parts: ['Мама сказала, что', {gap: ' она'}, ' придёт поздно.']},
      {kind: 'fill', parts: ['Он попросил, чтобы', {gap: ' ему'}, ' помогли.']},
      {kind: 'fill', parts: ['Она спросила', {gap: ','}, ' который час.']},
      {kind: 'fill', parts: ['«Уже поздно', {gap: ','}, ' — сказала мама. — Пора спать».']},
      {kind: 'fill', parts: ['Учитель сказал', {gap: ':'}, ' «Завтра контрольная».']},
      {kind: 'fill', parts: ['«Завтра контрольная»', {gap: ','}, ' — сказал учитель.']},
      {kind: 'fill', parts: ['«Скоро', {gap: ','}, ' — сказала мама, — будем ужинать».']},
      {kind: 'fill', parts: ['Он сказал, что', {gap: ' он'}, ' устал.']},
      {kind: 'fill', parts: ['Учитель велел, чтобы', {gap: ' мы'}, ' выполнили задание.']},
      {kind: 'fill', parts: ['Друг спросил', {gap: ','}, ' пойду ли я в кино.']},
      {kind: 'fill', parts: ['Она сказала', {gap: ':'}, ' «Я не согласна».']},
      {kind: 'choose', question: 'Косвенная речь оформляется как:', options: ['придаточное изъяснительное без кавычек', 'предложение в кавычках', 'отдельное самостоятельное предложение'], correct: 0}
    ]
  }
]

// ───────────────────────── main ─────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}. Run seedUsers.ts first.`)

  const parent = await prisma.category.findUniqueOrThrow({where: {slug: 'syntax'}})

  const report: {
    categories: {slug: string; id: string; isNew: boolean}[]
    topics: {
      slug: string
      postId?: string
      shortTestId?: string
      largeTestId?: string
      cheatSheetUrl?: string
      coverUrl?: string | null
      skipped: boolean
    }[]
    summaryPdfUrl?: string
  } = {categories: [], topics: []}

  // ── categories ──
  const categoryIds = new Map<string, string>()

  const simpleSentence = await prisma.category.findUniqueOrThrow({where: {slug: 'simple-sentence'}})
  categoryIds.set('simple-sentence', simpleSentence.id)
  report.categories.push({slug: 'simple-sentence', id: simpleSentence.id, isNew: false})

  const complexSentence = await upsertCategory('complex-sentence', parent.id, 3, COMPLEX_SENTENCE_TRANSLATIONS)
  categoryIds.set('complex-sentence', complexSentence.id)
  report.categories.push({slug: 'complex-sentence', id: complexSentence.id, isNew: false})
  console.log(`~ уточнён перевод категории complex-sentence (${complexSentence.id})`)

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

    // tests — идемпотентно: если тест с этим заголовком в этой категории уже создан
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

    // cover image — best-effort: KIE/velsvisual credits are a shared external resource
    // (drained in this run — see D01 in interfaces.md §8). Don't let a credits outage
    // block posts/tests/PDFs that don't need it; post is created without a MEDIA block
    // and the gap is tracked in the report instead of retried in a loop.
    let coverUrl: string | null = null
    try {
      const coverBuffer = await generateCoverImage(topic.coverPrompt)
      coverUrl = await uploadBuffer(coverBuffer, 'russian-course-images', 'jpg', teacher.id, 'image/jpeg')
      console.log(`  + обложка: ${coverUrl}`)
    } catch (e) {
      console.log(`  ! обложка не сгенерирована (${e instanceof Error ? e.message.split('\n')[0] : e}) — пост будет без MEDIA-блока`)
    }

    // post
    const blocks = [
      textBlock(topic.explanation),
      ...(coverUrl ? [mediaBlock(coverUrl, `Обложка темы «${topic.ruName}»`)] : []),
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
      coverUrl,
      skipped: false
    })
  }

  // ── block summary PDF ──
  const summaryBuffer = await buildSummaryPdf(
    'Синтаксис — оглавление блока',
    TOPICS.map((t) => ({name: t.ruName, line: t.summaryLine}))
  )
  const summaryUrl = await uploadBuffer(summaryBuffer, 'russian-course-cheatsheets', 'pdf', teacher.id, 'application/pdf')
  report.summaryPdfUrl = summaryUrl
  console.log(`\n+ сводный PDF блока «Синтаксис»: ${summaryUrl}`)

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
