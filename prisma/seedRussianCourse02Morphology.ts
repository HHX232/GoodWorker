/**
 * Seed: блок «Морфология» курса «Русский язык» (тикет 02, .autopilot/russian-course/).
 * Идемпотентно: категории — upsert по slug; тема — идемпотентна на уровне
 * «пост ИЛИ тесты уже существуют» (см. findOrCreateTest), не только «пост существует»
 * (урок D03 тикета 01).
 *
 * Run: npx tsx prisma/seedRussianCourse02Morphology.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
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
// D04: velsvisual/kie.ai исчерпал кредиты в середине тикета — переключено на
// api.bycom.by (interfaces.md §5, актуально с 2026-09-28). z-image-turbo — самая
// дешёвая модель из тех, что назвал пользователь (0.03 BYN/картинку), бюджет ограничен,
// по одной картинке на тему, без запасных вариантов (n=1).
const BYCOM_API_KEY = process.env.BYCOM_API_KEY
const IMAGE_MODEL = 'z-image-turbo'

// ───────────────────────── small id/content helpers ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc02-${Date.now()}-${++_uidCounter}`
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

// FILL_TEXT gaps are `inputGap` tiptap atom nodes (см. ticket 01 / InputGapNode.tsx).
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

// MatchPairsPayload: {pairs: {id, left, right}[]} — src/shared/types/Tasks/TaskPayload.type.ts:20.
function matchPairsBlock(pairs: {left: string; right: string}[]) {
  return {
    id: uid(),
    type: TaskBlockType.MATCH_PAIRS,
    payload: {pairs: pairs.map((p) => ({id: uid(), left: p.left, right: p.right}))}
  }
}

// HighlightTextPayload: {instruction, tokens: {id:number, text, isCorrect}[]} —
// TaskPayload.type.ts:52-61, scored by exact id set (scoreBlock.tsx:120).
function highlightTextBlock(instruction: string, tokens: {text: string; correct: boolean}[]) {
  return {
    id: uid(),
    type: TaskBlockType.HIGHLIGHT_TEXT,
    payload: {
      instruction,
      tokens: tokens.map((t, id) => ({id, text: t.text, isCorrect: t.correct}))
    }
  }
}

type BlockSpec =
  | {kind: 'choose'; question: string; options: string[]; correct: number}
  | {kind: 'fill'; parts: FillPart[]}
  | {kind: 'match'; pairs: {left: string; right: string}[]}
  | {kind: 'highlight'; instruction: string; tokens: {text: string; correct: boolean}[]}

function buildTestBlock(spec: BlockSpec) {
  switch (spec.kind) {
    case 'choose':
      return chooseBlock(spec.question, spec.options, spec.correct)
    case 'fill':
      return fillTextBlock(spec.parts)
    case 'match':
      return matchPairsBlock(spec.pairs)
    case 'highlight':
      return highlightTextBlock(spec.instruction, spec.tokens)
  }
}

// ───────────────────────── S3 upload ─────────────────────────

async function uploadBuffer(buffer: Buffer, folder: string, ext: string, teacherId: string, contentType: string) {
  const key = `${folder}/${teacherId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType}))
  return publicUrlForKey(key)
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

const NEW_CATEGORIES: {slug: string; translations: Record<'ru' | 'en' | 'hi' | 'zh', string>}[] = [
  {
    slug: 'noun-morphology',
    translations: {ru: 'Имя существительное', en: 'The Noun', hi: 'संज्ञा', zh: '名词'}
  },
  {
    slug: 'adjective-morphology',
    translations: {ru: 'Имя прилагательное', en: 'The Adjective', hi: 'विशेषण', zh: '形容词'}
  },
  {
    slug: 'verb-morphology',
    translations: {ru: 'Глагол', en: 'The Verb', hi: 'क्रिया', zh: '动词'}
  },
  {
    slug: 'pronoun-morphology',
    translations: {ru: 'Местоимение', en: 'The Pronoun', hi: 'सर्वनाम', zh: '代词'}
  },
  {
    slug: 'numeral-morphology',
    translations: {ru: 'Имя числительное', en: 'The Numeral', hi: 'संख्यावाचक विशेषण', zh: '数词'}
  },
  {
    slug: 'adverb-morphology',
    translations: {ru: 'Наречие', en: 'The Adverb', hi: 'क्रियाविशेषण', zh: '副词'}
  },
  {
    slug: 'function-words',
    translations: {
      ru: 'Предлог, союз, частица',
      en: 'Prepositions, Conjunctions, and Particles',
      hi: 'पूर्वसर्ग, समुच्चयबोधक और निपात',
      zh: '前置词、连词与语气词'
    }
  },
  {
    slug: 'interjections',
    translations: {
      ru: 'Междометие и звукоподражательные слова',
      en: 'Interjections and Onomatopoeia',
      hi: 'विस्मयादिबोधक शब्द और ध्वन्यनुकरण शब्द',
      zh: '感叹词与拟声词'
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
  {
    slug: 'parts-of-speech',
    ruName: 'Части речи: система',
    postTitle: 'Части речи русского языка: полная система',
    explanation: [
      'Все слова русского языка делятся на самостоятельные (знаменательные) части речи, которые называют предметы, признаки, действия или количество и являются членами предложения, и служебные части речи, которые связывают слова и части предложения, но сами членами предложения не являются. Особняком стоит междометие: оно не называет и не связывает, а выражает эмоции.',
      'Самостоятельные части речи: имя существительное (кто? что?), имя прилагательное (какой? чей?), имя числительное (сколько? который?), местоимение (указывает на предмет/признак/количество, не называя их), глагол (что делать? что сделать?) вместе с особыми формами — причастием (какой? что делающий?) и деепричастием (что делая? что сделав?), наречие (как? когда? где? куда?).',
      'Служебные части речи не являются членами предложения: предлог связывает слова в словосочетании (в, на, из-за), союз связывает однородные члены и части сложного предложения (и, а, но, потому что), частица вносит в предложение смысловой или эмоциональный оттенок (не, ни, бы, же, ли).',
      'Междометие (ах, ой, увы) и звукоподражательные слова (мяу, тик-так) не входят ни в самостоятельные, ни в служебные части речи: они не называют предмет и не связывают слова, а выражают эмоцию или имитируют звук.'
    ],
    coverPrompt:
      'Flat editorial illustration of a wooden sorting tray with small labeled abstract tokens being organized into rows, soft pastel palette, minimalist composition, no readable text',
    cheatSheetLines: [
      'Самостоятельные части речи называют предмет/признак/действие/количество и являются членами предложения.',
      'Существительное — кто? что?; прилагательное — какой? чей?; числительное — сколько? который?',
      'Местоимение указывает на предмет/признак/количество, не называя их: он, такой, столько.',
      'Глагол — что делать?/что сделать?; причастие (особая форма глагола) — какой? что делающий?; деепричастие — что делая?/что сделав?',
      'Наречие — как? когда? где? куда? откуда? почему?; не изменяется.',
      'Служебные части речи не члены предложения: предлог связывает слова (в, из-за), союз — части предложения (и, но, потому что), частица вносит оттенок смысла (не, бы, же).',
      'Междометие и звукоподражательные слова стоят особняком: выражают эмоцию или имитируют звук (ах, мяу), не называют и не связывают.'
    ],
    summaryLine: '10 самостоятельных частей речи + 3 служебные + междометие особняком — разряд определяем по вопросу и роли в предложении.',
    shortTestTitle: 'Части речи: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [{left: 'быстро', right: 'наречие'}, {left: 'бежал', right: 'глагол'}]},
      {kind: 'match', pairs: [{left: 'пять', right: 'числительное'}, {left: 'какой', right: 'местоимение'}]},
      {kind: 'match', pairs: [{left: 'счастье', right: 'существительное'}, {left: 'красивый', right: 'прилагательное'}]},
      {kind: 'match', pairs: [{left: 'в', right: 'предлог'}, {left: 'и', right: 'союз'}]},
      {kind: 'match', pairs: [{left: 'не', right: 'частица'}, {left: 'ах', right: 'междометие'}]},
      {kind: 'match', pairs: [{left: 'читающий', right: 'причастие'}, {left: 'читая', right: 'деепричастие'}]}
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
      {kind: 'match', pairs: [{left: 'пятеро', right: 'числительное'}, {left: 'свой', right: 'местоимение'}]}
    ]
  },
  {
    slug: 'participles-gerunds',
    ruName: 'Причастия и деепричастия',
    postTitle: 'Причастие и деепричастие: как отличить особые формы глагола',
    explanation: [
      'Причастие и деепричастие — особые формы глагола, которые совмещают его признаки с признаками другой части речи. Причастие совмещает признаки глагола и прилагательного, деепричастие — признаки глагола и наречия.',
      'Причастие отвечает на вопросы какой? что делающий? что сделавший? и изменяется, как прилагательное, — по родам, числам и падежам (читающий, читающая, читающие, читающего). Действительные причастия обозначают признак предмета, который сам совершает действие (читающий мальчик): суффиксы -ущ-/-ющ-/-ащ-/-ящ- в настоящем времени и -вш-/-ш- в прошедшем. Страдательные причастия обозначают признак предмета, над которым совершают действие (прочитанная книга): суффиксы -ем-/-ом-/-им- в настоящем времени и -нн-/-енн-/-т- в прошедшем.',
      'Деепричастие отвечает на вопросы что делая? что сделав? и не изменяется, как наречие, всегда относится к глаголу-сказуемому и обозначает добавочное действие того же субъекта: он шёл, напевая (действие одновременно с основным, несовершенный вид, суффиксы -а-/-я-); он вышел, хлопнув дверью (действие, предшествующее основному, совершенный вид, суффиксы -в-/-вши-/-ши-).',
      'Причастие от прилагательного отличают заменой оборотом «который + глагол»: кипящая вода = вода, которая кипит; у прилагательного такая замена невозможна (кипучая энергия — постоянный признак, не «которая кипит»). Деепричастие от наречия отличают по вопросу: деепричастие отвечает на «что делая?/что сделав?» и обозначает добавочное действие, наречие — на «как?» и действия не обозначает.'
    ],
    coverPrompt:
      'Minimalist editorial photo of two intertwined silk ribbons forming a loop on a wooden desk, symbolizing merging grammatical forms, soft warm light, no readable text',
    cheatSheetLines: [
      'Причастие = глагол + прилагательное: какой? что делающий?; изменяется по родам/числам/падежам.',
      'Действительное причастие (само действует): наст. -ущ-/-ющ-/-ащ-/-ящ- (читающий); прош. -вш-/-ш- (читавший).',
      'Страдательное причастие (действие над ним): наст. -ем-/-ом-/-им- (читаемый); прош. -нн-/-енн-/-т- (прочитанный).',
      'Деепричастие = глагол + наречие: что делая? что сделав?; не изменяется, обозначает добавочное действие.',
      'Несов. вид (одновременно с основным): -а-/-я- (напевая). Сов. вид (предшествует основному): -в-/-вши-/-ши- (хлопнув).',
      'Причастие -> прилагательное: заменяем оборотом «который + глагол» (кипящая = которая кипит).',
      'Деепричастие -> наречие: деепричастие отвечает «что делая?» и обозначает добавочное действие того же субъекта.'
    ],
    summaryLine: 'Причастие меняется как прилагательное (какой?), деепричастие не меняется, как наречие (что делая?/что сделав?).',
    shortTestTitle: 'Причастия и деепричастия: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Кипящая вода — причастие или прилагательное (можно заменить «которая кипит»)?', options: ['причастие', 'прилагательное'], correct: 0},
      {kind: 'choose', question: 'Он шёл, напевая песню — деепричастие или наречие (обозначает добавочное действие)?', options: ['деепричастие', 'наречие'], correct: 0},
      {kind: 'choose', question: 'Прочитанная книга — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 1},
      {kind: 'choose', question: 'Читающий мальчик — действительное или страдательное причастие?', options: ['действительное', 'страдательное'], correct: 0},
      {kind: 'choose', question: 'Хлопнув дверью, он вышел — какой вид деепричастия (действие предшествует основному)?', options: ['совершенный', 'несовершенный'], correct: 0},
      {kind: 'choose', question: 'Улыбаясь, она поздоровалась — какой вид деепричастия (действие одновременно с основным)?', options: ['совершенный', 'несовершенный'], correct: 1}
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
      {kind: 'choose', question: 'Сидя у окна, она читала — деепричастие или наречие (обозначает добавочное действие того же лица)?', options: ['деепричастие', 'наречие'], correct: 0},
      {kind: 'choose', question: 'Он ответил сидя (положение тела, устойчивое обстоятельство) — можно ли заменить «который сидит»?', options: ['да, это деепричастие', 'нет, замена невозможна'], correct: 0},
      {kind: 'choose', question: 'Вспыхнувший костёр — действительное причастие какого времени?', options: ['настоящего', 'прошедшего'], correct: 1}
    ]
  },
  {
    slug: 'noun-morphology',
    ruName: 'Имя существительное',
    postTitle: 'Имя существительное: род, число, падеж, склонение',
    explanation: [
      'Имя существительное — самостоятельная часть речи, которая называет предмет и отвечает на вопросы кто? что? Постоянные признаки существительного — одушевлённость/неодушевлённость, собственное/нарицательное, род, склонение; непостоянные — падеж и число.',
      'Род определяется по начальной форме (им. п., ед. ч.): мужской (стол, конь — нулевое окончание), женский (страна, земля — окончание -а/-я), средний (окно, поле — окончание -о/-е). Есть существительные общего рода, которые могут быть и мужского, и женского в зависимости от того, о ком идёт речь (плакса, неряха, сирота).',
      'Склонение — изменение по падежам. 1-е склонение — существительные женского и мужского рода с окончанием -а/-я (страна, папа, земля). 2-е склонение — существительные мужского рода с нулевым окончанием и среднего рода на -о/-е (стол, конь, окно, поле). 3-е склонение — существительные женского рода с нулевым окончанием и Ь на конце (ночь, степь, мышь).',
      'Разносклоняемые существительные — 10 слов на -мя (время, имя, племя, семя, стремя, темя, бремя, вымя, знамя, пламя) и слово путь: в родительном, дательном и предложном падежах единственного числа они получают окончание -и, как 3-е склонение, а в творительном — окончание -ем, как 2-е (времени, но временем).',
      'Падеж показывает роль существительного в предложении, определяется вопросом и часто предлогом: именительный (кто? что?), родительный (кого? чего?), дательный (кому? чему?), винительный (кого? что?), творительный (кем? чем?), предложный (о ком? о чём?).'
    ],
    coverPrompt:
      'Warm still life of small labeled museum specimen jars with vintage paper tags arranged on a wooden shelf, soft daylight, academic atmosphere, no readable text',
    cheatSheetLines: [
      'Род (в им.п. ед.ч.): муж. — нулевое окончание (стол); жен. — -а/-я (страна); ср. — -о/-е (окно).',
      'Общий род: плакса, неряха, сирота — м. или ж. в зависимости от того, о ком речь.',
      '1 скл.: жен./муж. род на -а/-я (страна, папа). 2 скл.: муж. род без окончания + ср. род на -о/-е (стол, окно).',
      '3 скл.: жен. род с Ь на конце, нулевое окончание (ночь, степь, мышь).',
      'Разносклоняемые: путь + 10 слов на -мя (время, имя, племя, семя, стремя, темя, бремя, вымя, знамя, пламя).',
      'У слов на -мя: Р./Д./П.п. ед.ч. — окончание -и, как 3 скл. (времени); Т.п. — окончание -ем, как 2 скл. (временем).',
      'Падежи: И.п. кто? что?; Р.п. кого? чего?; Д.п. кому? чему?; В.п. кого? что?; Т.п. кем? чем?; П.п. о ком? о чём?'
    ],
    summaryLine: 'Существительное: род и склонение — постоянные признаки, падеж и число — непостоянные; 10 слов на -мя и путь склоняются по-особому.',
    shortTestTitle: 'Имя существительное: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['о врем', {gap: 'ени'}]},
      {kind: 'fill', parts: ['нет им', {gap: 'ени'}]},
      {kind: 'fill', parts: ['к плем', {gap: 'ени'}]},
      {kind: 'fill', parts: ['за врем', {gap: 'енем'}]},
      {kind: 'fill', parts: ['иду по пут', {gap: 'и'}]},
      {kind: 'fill', parts: ['горжусь пут', {gap: 'ём'}]}
    ],
    largeTestTitle: 'Имя существительное: большой тест на склонения',
    largeTestBlocks: [
      {kind: 'fill', parts: ['о стран', {gap: 'е'}]},
      {kind: 'fill', parts: ['к земл', {gap: 'е'}]},
      {kind: 'fill', parts: ['на лини', {gap: 'и'}]},
      {kind: 'fill', parts: ['о стол', {gap: 'е'}]},
      {kind: 'fill', parts: ['в здани', {gap: 'и'}]},
      {kind: 'fill', parts: ['на площад', {gap: 'и'}]},
      {kind: 'fill', parts: ['к ноч', {gap: 'и'}]},
      {kind: 'fill', parts: ['нет сем', {gap: 'ени'}]},
      {kind: 'fill', parts: ['к знам', {gap: 'ени'}]},
      {kind: 'fill', parts: ['горжусь знам', {gap: 'енем'}]},
      {kind: 'fill', parts: ['над пламен', {gap: 'ем'}]},
      {kind: 'fill', parts: ['без брем', {gap: 'ени'}]},
      {kind: 'fill', parts: ['нет пут', {gap: 'и'}]},
      {kind: 'fill', parts: ['вым', {gap: 'ени'}]}
    ]
  },
  {
    slug: 'adjective-morphology',
    ruName: 'Имя прилагательное',
    postTitle: 'Имя прилагательное: разряды и степени сравнения',
    explanation: [
      'Имя прилагательное — самостоятельная часть речи, которая обозначает признак предмета и отвечает на вопросы какой? какая? какое? чей? Прилагательное согласуется с существительным в роде, числе и падеже.',
      'По значению прилагательные делятся на три разряда. Качественные обозначают признак, который может проявляться в большей или меньшей степени (высокий, красивый, умный) — от них образуются степени сравнения и краткая форма. Относительные обозначают признак через отношение к другому предмету, материалу, месту, времени (деревянный стол = стол из дерева) — степеней сравнения и краткой формы у них нет. Притяжательные обозначают принадлежность конкретному лицу или животному и отвечают на вопрос чей? (мамин платок, лисий хвост, волчья нора).',
      'Определить разряд помогает вопрос «в какой мере?/насколько?»: если признак можно усилить (очень высокий, самый красивый) — прилагательное качественное. Если слово заменяется оборотом «из чего/для чего/когда» — относительное. Если можно задать вопрос «чей?» и указать конкретного владельца — притяжательное. Один и тот же корень иногда даёт слова из разных разрядов: золотой браслет (относительное, «из золота») и золотой характер (качественное, переносное значение — «очень хороший»).',
      'Степени сравнения бывают только у качественных прилагательных. Сравнительная степень: простая форма образуется суффиксами -ее(-ей)/-е/-ше (умнее, громче, тоньше), составная — словом «более/менее» + начальная форма (более умный). Превосходная степень: простая форма — суффиксами -ейш-/-айш- (умнейший, высочайший), составная — словом «самый/наиболее» + начальная форма (самый умный) или простая сравнительная степень + слово «всех/всего» (умнее всех).'
    ],
    coverPrompt:
      'Close-up editorial photo of a color palette with paint swatches graded from pale to intense hue, soft studio light, minimalist composition, no readable text',
    cheatSheetLines: [
      'Качественные: признак в большей/меньшей степени (высокий, красивый) — образуют степени сравнения и краткую форму.',
      'Относительные: признак через отношение к предмету/материалу/времени (деревянный, вчерашний) — степеней сравнения нет.',
      'Притяжательные: чей? — принадлежность лицу/животному (мамин, лисий, волчья).',
      'Проверка разряда: усиливается «очень» — качественное; заменяется «из чего/когда» — относительное; отвечает «чей?» — притяжательное.',
      'Одно слово в разных значениях — разные разряды: золотой браслет (относит.), золотой характер (качеств., переносное).',
      'Сравнительная степень: простая — -ее/-ей/-е/-ше (умнее, громче); составная — более/менее + слово (более умный).',
      'Превосходная степень: простая — -ейш-/-айш- (умнейший); составная — самый/наиболее + слово, или сравнит. степень + всех (самый умный, умнее всех).'
    ],
    summaryLine: 'Разряд — по вопросу и способности усилиться (качественное/относительное/притяжательное); степени сравнения — только у качественных.',
    shortTestTitle: 'Имя прилагательное: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Деревянный стол — какой разряд (стол из дерева)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 1},
      {kind: 'choose', question: 'Высокий дом — какой разряд (можно сказать «очень высокий»)?', options: ['качественное', 'относительное', 'притяжательное'], correct: 0},
      {kind: 'choose', question: 'Лисий хвост — какой разряд (хвост чей?)', options: ['качественное', 'относительное', 'притяжательное'], correct: 2},
      {kind: 'choose', question: 'Умнее — простая или составная форма сравнительной степени?', options: ['простая', 'составная'], correct: 0},
      {kind: 'choose', question: 'Более умный — простая или составная форма сравнительной степени?', options: ['простая', 'составная'], correct: 1},
      {kind: 'choose', question: 'Умнейший — простая или составная форма превосходной степени?', options: ['простая', 'составная'], correct: 0}
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
      {kind: 'choose', question: 'Громче — какая степень сравнения (простая форма)?', options: ['сравнительная', 'превосходная'], correct: 0},
      {kind: 'choose', question: 'Менее интересный — какая степень сравнения?', options: ['сравнительная', 'превосходная'], correct: 0},
      {kind: 'choose', question: 'Есть ли степени сравнения у прилагательного «стеклянный» (относительное)?', options: ['да', 'нет'], correct: 1},
      {kind: 'choose', question: 'Есть ли краткая форма у прилагательного «добрый» (качественное)?', options: ['да', 'нет'], correct: 0}
    ]
  },
  {
    slug: 'verb-morphology',
    ruName: 'Глагол',
    postTitle: 'Глагол: вид, время, спряжение, наклонение, переходность',
    explanation: [
      'Глагол — самостоятельная часть речи, которая обозначает действие или состояние предмета и отвечает на вопросы что делать? что сделать? Глагол — одна из самых грамматически насыщенных частей речи: у него больше морфологических категорий, чем у любой другой.',
      'Вид показывает, закончено действие или нет. Несовершенный вид отвечает на вопрос что делать? и обозначает длящееся или повторяющееся действие без указания на результат (писать, читать). Совершенный вид отвечает на вопрос что сделать? и обозначает законченное действие с результатом (написать, прочитать). Большинство глаголов образуют видовые пары (писать — написать), но есть двувидовые глаголы, у которых оба значения совмещены в одной форме (женить, ранить, казнить).',
      'Время есть только у глаголов в изъявительном наклонении: настоящее (что делаю? — пишу), прошедшее (что делал? — писал), будущее (что сделаю?/что буду делать? — напишу/буду писать). У глаголов совершенного вида будущее время простое (напишу), у несовершенного — составное (буду писать).',
      'Спряжение — изменение по лицам и числам в настоящем/будущем времени. II спряжение — все глаголы на -ить (кроме брить, стелить, зиждиться) и 11 глаголов-исключений (гнать, держать, дышать, слышать, видеть, ненавидеть, зависеть, терпеть, обидеть, вертеть, смотреть); окончания -ит/-ат(-ят). I спряжение — все остальные глаголы, окончания -ет/-ут(-ют). Разноспрягаемые глаголы хотеть и бежать в разных формах спрягаются то по I, то по II спряжению: хочу, хочешь, хочет (I) — хотим, хотите, хотят (II); бегу, бежишь, бежит, бежим, бежите (II) — бегут (I).',
      'Наклонение показывает отношение действия к реальности. Изъявительное — действие реально происходит в прошлом/настоящем/будущем (пишу, писал, напишу). Условное (сослагательное) — действие возможно при определённом условии, образуется формой прошедшего времени + частица бы (написал бы). Повелительное — приказ, просьба, побуждение к действию (напиши, напишите).',
      'Переходность показывает, может ли глагол иметь при себе прямое дополнение в винительном падеже без предлога. Переходные глаголы обозначают действие, направленное на объект (читать книгу, видеть друга). Непереходные глаголы такого дополнения не принимают (идти, сидеть, радоваться); к ним же относятся все возвратные глаголы на -ся/-сь (умываться, смеяться).'
    ],
    coverPrompt:
      'Editorial still life of an old alarm clock and a pair of running shoes on a wooden floor with soft motion blur suggesting action and time, warm light, no readable text',
    cheatSheetLines: [
      'Вид: несов. — что делать? (писать, длится/повторяется); сов. — что сделать? (написать, есть результат).',
      'Двувидовые глаголы (женить, ранить, казнить) — сов. и несов. значение в одной форме.',
      'Время — только у изъявит. наклонения: наст. (пишу), прош. (писал), буд. простое у сов. вида (напишу) / составное у несов. (буду писать).',
      'II спряжение: глаголы на -ить (кроме брить, стелить, зиждиться) + 11 искл. (гнать, держать, дышать, слышать, видеть, ненавидеть, зависеть, терпеть, обидеть, вертеть, смотреть) — окончания -ит/-ат(-ят).',
      'I спряжение — все остальные глаголы, окончания -ет/-ут(-ют).',
      'Разноспрягаемые: хотеть (хочу-хочешь-хочет по I, хотим-хотите-хотят по II), бежать (бегу...бежите по II, бегут по I).',
      'Наклонение: изъявит. (пишу/писал/напишу — реальность); условное (написал бы — при условии); повелительное (напиши! — побуждение).',
      'Переходность: переходный глагол + сущ. в В.п. без предлога (читать книгу); непереходный — без такого дополнения (идти), сюда же все глаголы на -ся/-сь.'
    ],
    summaryLine: 'Глагол: вид (сов./несов.), время (только изъявит.), спряжение по -ить/11 искл., наклонение (изъявит./условное/повелит.), переходность по В.п. без предлога.',
    shortTestTitle: 'Глагол: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['ты пиш', {gap: 'ешь'}]},
      {kind: 'fill', parts: ['он вид', {gap: 'ит'}]},
      {kind: 'fill', parts: ['они кле', {gap: 'ят'}]},
      {kind: 'fill', parts: ['она хо', {gap: 'чет'}]},
      {kind: 'fill', parts: ['мы хот', {gap: 'им'}]},
      {kind: 'fill', parts: ['вы беж', {gap: 'ите'}]}
    ],
    largeTestTitle: 'Глагол: большой тест на спряжение и исключения',
    largeTestBlocks: [
      {kind: 'fill', parts: ['она чита', {gap: 'ет'}]},
      {kind: 'fill', parts: ['они чита', {gap: 'ют'}]},
      {kind: 'fill', parts: ['он гон', {gap: 'ит'}]},
      {kind: 'fill', parts: ['они гон', {gap: 'ят'}]},
      {kind: 'fill', parts: ['ты держ', {gap: 'ишь'}]},
      {kind: 'fill', parts: ['они держ', {gap: 'ат'}]},
      {kind: 'fill', parts: ['он бре', {gap: 'ет'}]},
      {kind: 'fill', parts: ['они бре', {gap: 'ют'}]},
      {kind: 'fill', parts: ['он стел', {gap: 'ет'}]},
      {kind: 'fill', parts: ['они бег', {gap: 'ут'}]},
      {kind: 'fill', parts: ['он терп', {gap: 'ит'}]},
      {kind: 'fill', parts: ['она завис', {gap: 'ит'}]},
      {kind: 'fill', parts: ['ты дыш', {gap: 'ишь'}]},
      {kind: 'fill', parts: ['они смотр', {gap: 'ят'}]}
    ]
  },
  {
    slug: 'pronoun-morphology',
    ruName: 'Местоимение',
    postTitle: 'Местоимение: разряды по значению',
    explanation: [
      'Местоимение — самостоятельная часть речи, которая не называет предмет, признак или количество, а лишь указывает на них, замещая существительное, прилагательное или числительное в тексте: «Аня открыла книгу. Она читала её» звучит естественнее, чем повтор «Аня... книгу».',
      'По значению местоимения делятся на 9 разрядов. Личные (я, ты, он, она, оно, мы, вы, они) указывают на участников речи. Возвратное (себя) указывает на то, что действие направлено на самого производителя действия, не имеет формы именительного падежа, рода и числа. Притяжательные (мой, твой, свой, наш, ваш, его, её, их) указывают на принадлежность.',
      'Указательные (этот, тот, такой, таков, столько) выделяют предмет, признак или количество среди других. Определительные (весь, всякий, каждый, любой, сам, самый, иной, другой) уточняют предмет, придают значение обобщения или выделения. Вопросительные (кто, что, какой, чей, сколько, который) используются в вопросе, а те же слова без вопроса, но для связи частей сложного предложения, называются относительными — важна функция, а не форма слова.',
      'Неопределённые (некто, нечто, некоторый, несколько, кто-то, что-либо, кое-кто) указывают на неизвестный или неважный для говорящего предмет; образуются от вопросительных приставками не-/кое- или суффиксами -то/-либо/-нибудь. Отрицательные (никто, ничто, никакой, ничей, нисколько, некого, нечего) указывают на отсутствие предмета/признака; приставка не- пишется под ударением, ни- — без ударения: некого спросить — никого не спросил.'
    ],
    coverPrompt:
      'Minimalist flat illustration of abstract silhouette figures connected by soft dotted lines, pointing toward one another, muted pastel palette, no readable text',
    cheatSheetLines: [
      'Личные: я, ты, он/она/оно, мы, вы, они — указывают на участников речи.',
      'Возвратное: себя — нет им.п., рода, числа; действие направлено на производителя.',
      'Притяжательные: мой, твой, свой, наш, ваш, его, её, их — принадлежность.',
      'Указательные: этот, тот, такой, таков, столько. Определительные: весь, всякий, каждый, любой, сам, самый, иной.',
      'Вопросительные (в вопросе) и относительные (для связи частей сложного предложения) — одни и те же слова: кто, что, какой, чей, сколько, который.',
      'Неопределённые: некто, нечто, кто-то, что-либо, кое-кто — приставки не-/кое-, суффиксы -то/-либо/-нибудь.',
      'Отрицательные: никто, ничто, никакой, ничей — приставка не- под ударением (некого), ни- без ударения (никого).'
    ],
    summaryLine: '9 разрядов местоимений по значению: личные, возвратное, притяжательные, указательные, определительные, вопросительные/относительные, неопределённые, отрицательные.',
    shortTestTitle: 'Местоимение: короткая проверка',
    shortTestBlocks: [
      {kind: 'match', pairs: [{left: 'я', right: 'личное'}, {left: 'себя', right: 'возвратное'}]},
      {kind: 'match', pairs: [{left: 'мой', right: 'притяжательное'}, {left: 'этот', right: 'указательное'}]},
      {kind: 'match', pairs: [{left: 'весь', right: 'определительное'}, {left: 'кто', right: 'вопросительное'}]},
      {kind: 'match', pairs: [{left: 'кто-то', right: 'неопределённое'}, {left: 'никто', right: 'отрицательное'}]},
      {kind: 'match', pairs: [{left: 'каждый', right: 'определительное'}, {left: 'наш', right: 'притяжательное'}]},
      {kind: 'match', pairs: [{left: 'столько', right: 'указательное'}, {left: 'чей', right: 'вопросительное'}]}
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
      {kind: 'match', pairs: [{left: 'тот', right: 'указательное'}, {left: 'такая', right: 'указательное'}]}
    ]
  },
  {
    slug: 'numeral-morphology',
    ruName: 'Имя числительное',
    postTitle: 'Имя числительное: разряды и склонение сложных форм',
    explanation: [
      'Имя числительное — самостоятельная часть речи, которая обозначает количество предметов, число или порядок предметов при счёте и отвечает на вопросы сколько? который?',
      'По значению числительные делятся на количественные (сколько? — пять, сто, тридцать три) и порядковые (который? — пятый, сотый, тридцать третий). Количественные, в свою очередь, делятся на собственно количественные (обозначают целое число: пять, сорок), дробные (две пятых, полтора) и собирательные (двое, трое, четверо — сочетаются только с существительными мужского рода, словом «дети» и названиями детёнышей животных).',
      'По составу числительные бывают простые (одно слово, один корень: пять, десятый), сложные (одно слово, два корня: пятьдесят, семьсот) и составные (несколько слов: сто двадцать три, три пятых).',
      'Склонение сложных и составных количественных числительных — одна из самых трудных тем: при склонении сложного числительного изменяются обе его части (пятьюдесятью — оба корня получили окончание), а у составного числительного склоняется каждое слово отдельно (тремястами двадцатью тремя рублями — три слова, три окончания). Числительное полтора имеет только две падежные формы: полтора/полторы (им./вин.) и полутора (все остальные падежи).',
      'Порядковые числительные склоняются как прилагательные, и при склонении составного порядкового числительного изменяется только последнее слово (в тысяча девятьсот сорок пятом году — изменилось только «сорок пятом», «тысяча девятьсот» остались в начальной форме).'
    ],
    coverPrompt:
      'Warm editorial photo of scattered wooden number blocks and an old wooden abacus on a desk, natural light, no readable text',
    cheatSheetLines: [
      'Количественные — сколько? (пять); порядковые — который? (пятый).',
      'Количественные делятся на: целые (пять), дробные (две пятых, полтора), собирательные (двое, трое — с сущ. м.р., детьми, детёнышами).',
      'По составу: простые (пять), сложные — 1 слово 2 корня (пятьдесят), составные — неск. слов (сто двадцать три).',
      'Склонение сложного числительного: изменяются ОБЕ части — пятьюдесятью (оба корня с окончанием).',
      'Склонение составного числительного: склоняется КАЖДОЕ слово — тремястами двадцатью тремя.',
      'Полтора/полторы — только в им./вин.п.; во всех остальных падежах — полутора.',
      'Порядковые склоняются как прилагательные; у составного порядкового изменяется только ПОСЛЕДНЕЕ слово: в тысяча девятьсот сорок пятом году.'
    ],
    summaryLine: 'Числительное: количественное (целое/дробное/собирательное) или порядковое; простое/сложное/составное по составу; сложные и составные склоняются по-разному.',
    shortTestTitle: 'Имя числительное: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['п', {gap: 'яти'}, ' книгам']},
      {kind: 'fill', parts: ['шест', {gap: 'ью'}, ' карандашами']},
      {kind: 'fill', parts: ['восьм', {gap: 'и'}, ' часов']},
      {kind: 'fill', parts: ['пятьюдесят', {gap: 'ью'}, ' рублями']},
      {kind: 'fill', parts: ['п', {gap: 'олутора'}, ' часов']},
      {kind: 'fill', parts: ['тр', {gap: 'ёхсот'}, ' метров']}
    ],
    largeTestTitle: 'Имя числительное: большой тест на склонение сложных и составных форм',
    largeTestBlocks: [
      {kind: 'fill', parts: ['девяност', {gap: 'а'}, ' рублей']},
      {kind: 'fill', parts: ['ст', {gap: 'а'}, ' книг']},
      {kind: 'fill', parts: ['дв', {gap: 'умстам'}, ' ученикам']},
      {kind: 'fill', parts: ['четырьмяст', {gap: 'ами'}, ' рублями']},
      {kind: 'fill', parts: ['сем', {gap: 'ьюстами'}, ' метрами']},
      {kind: 'fill', parts: ['', {gap: 'тремястами'}, ' двадцатью ', {gap: 'тремя'}, ' рублями']},
      {kind: 'fill', parts: ['дво', {gap: 'е'}, ' друзей']},
      {kind: 'fill', parts: ['четвер', {gap: 'о'}, ' щенят']},
      {kind: 'fill', parts: ['в тысяча девятьсот сорок пят', {gap: 'ом'}, ' году']},
      {kind: 'fill', parts: ['в две тысячи двадцать четвёрт', {gap: 'ом'}, ' году']},
      {kind: 'fill', parts: ['полтор', {gap: 'ы'}, ' ложки']},
      {kind: 'fill', parts: ['тр', {gap: 'идцати трём'}, ' участникам']},
      {kind: 'fill', parts: ['п', {gap: 'ятидесяти шести'}, ' страницам']},
      {kind: 'fill', parts: ['девят', {gap: 'ьюстами'}, ' граммами']}
    ]
  },
  {
    slug: 'adverb-morphology',
    ruName: 'Наречие',
    postTitle: 'Наречие: разряды, степени сравнения, отличие от слов категории состояния',
    explanation: [
      'Наречие — самостоятельная неизменяемая часть речи, которая обозначает признак действия, признака или предмета и отвечает на вопросы как? когда? где? куда? откуда? почему? зачем? в какой степени? Наречие не изменяется по родам, числам и падежам — в этом его главное отличие от прилагательного.',
      'По значению наречия делятся на определительные (качество, способ, мера и степень действия: быстро, весело, вдвое, очень) и обстоятельственные (время, место, причина, цель: вчера, издалека, сгоряча, назло). Разряд определяет вопрос: как? — определительное; когда?/где?/куда?/откуда? — время или место; почему? — причина; зачем? — цель.',
      'Качественные наречия на -о/-е, образованные от качественных прилагательных, образуют степени сравнения так же, как прилагательные: сравнительная степень — простая (быстрее, громче) или составная (более быстро); превосходная — почти всегда составная, простая сравнительная степень + слово «всех/всего» (быстрее всех).',
      'Наречие на -о легко спутать с кратким прилагательным среднего рода и словом категории состояния — формы могут выглядеть одинаково (весело). Различаем по роли в предложении: наречие относится к глаголу и является обстоятельством (он говорил весело — говорил как? весело); краткое прилагательное относится к существительному и является сказуемым, согласуется в роде и числе (лицо было весело — лицо каково? весело, ср. р.); слово категории состояния употребляется в безличном предложении без подлежащего (на улице было весело — весело обозначает состояние среды).'
    ],
    coverPrompt:
      'Editorial photo of a vintage stopwatch beside a blurred running figure with a motion trail, warm daylight, minimalist composition, no readable text',
    cheatSheetLines: [
      'Наречие — неизменяемая часть речи: как? когда? где? куда? откуда? почему? зачем? в какой степени?',
      'Определительные (качество/способ/мера): быстро, весело, вдвое, очень.',
      'Обстоятельственные: времени (вчера), места (издалека), причины (сгоряча), цели (назло).',
      'Степени сравнения (от кач. наречий на -о/-е): сравнит. простая (быстрее), составная (более быстро); превосх. — почти всегда составная (быстрее всех).',
      'Тест-приём: подставь вопрос. Говорил (как?) весело — наречие, относится к глаголу, обстоятельство.',
      'Лицо было (каково?) весело — краткое прилагательное, относится к сущ., сказуемое, есть род/число.',
      'На улице было весело (без подлежащего) — слово категории состояния, обозначает состояние среды.'
    ],
    summaryLine: 'Наречие — неизменяемо, вопрос как?/когда?/где?; отличаем от краткого прилагательного и слова состояния по роли в предложении.',
    shortTestTitle: 'Наречие: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Он говорил (как?) весело — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 0},
      {kind: 'choose', question: 'Лицо было (каково?) весело — какая часть речи (согласуется с сущ. «лицо», ср.р.)?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'На улице было весело (нет подлежащего) — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 2},
      {kind: 'choose', question: 'Быстрее — простая или составная сравнительная степень?', options: ['простая', 'составная'], correct: 0},
      {kind: 'choose', question: 'Более быстро — простая или составная сравнительная степень?', options: ['простая', 'составная'], correct: 1},
      {kind: 'choose', question: 'Вчера — определительное или обстоятельственное наречие?', options: ['определительное', 'обстоятельственное'], correct: 1}
    ],
    largeTestTitle: 'Наречие: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Дети играли (как?) весело — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 0},
      {kind: 'choose', question: 'Море было спокойно (каково?) — какая часть речи (согласуется с «море», ср.р.)?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'В комнате было спокойно (без подлежащего) — какая часть речи?', options: ['наречие', 'краткое прилагательное', 'слово категории состояния'], correct: 2},
      {kind: 'choose', question: 'Быстрее всех — простая или составная превосходная степень?', options: ['простая', 'составная'], correct: 1},
      {kind: 'choose', question: 'Самый быстрый — это степень сравнения наречия или прилагательного (относится к сущ., изменяется по родам)?', options: ['наречия', 'прилагательного'], correct: 1},
      {kind: 'choose', question: 'Издалека — определительное или обстоятельственное наречие (место)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Очень — определительное или обстоятельственное наречие (мера/степень)?', options: ['определительное', 'обстоятельственное'], correct: 0},
      {kind: 'choose', question: 'Сгоряча — определительное или обстоятельственное наречие (причина)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Назло — определительное или обстоятельственное наречие (цель)?', options: ['определительное', 'обстоятельственное'], correct: 1},
      {kind: 'choose', question: 'Вдвое — определительное или обстоятельственное наречие (мера)?', options: ['определительное', 'обстоятельственное'], correct: 0},
      {kind: 'choose', question: 'Ему было грустно (безличное предложение, нет подлежащего) — какая часть речи?', options: ['наречие', 'слово категории состояния'], correct: 1},
      {kind: 'choose', question: 'Он улыбался грустно (как?) — какая часть речи?', options: ['наречие', 'слово категории состояния'], correct: 0},
      {kind: 'choose', question: 'Небо ясно (каково?, согласуется с «небо») — какая часть речи?', options: ['краткое прилагательное', 'наречие'], correct: 0},
      {kind: 'choose', question: 'Она ответила ясно (как?) — какая часть речи?', options: ['краткое прилагательное', 'наречие'], correct: 1}
    ]
  },
  {
    slug: 'function-words',
    ruName: 'Предлог, союз, частица',
    postTitle: 'Служебные части речи: как различить предлог, союз и частицу',
    explanation: [
      'Предлог, союз и частица — служебные части речи: они не называют предметов, признаков или действий и не являются членами предложения, но выполняют важную грамматическую работу — связывают слова, части предложения или вносят смысловые оттенки.',
      'Предлог выражает зависимость существительного, местоимения или числительного от других слов в словосочетании и всегда стоит перед этим словом: идти в школу, думать о друге, несмотря на дождь. Непроизводные предлоги (в, на, с, из, к, у) существовали в языке изначально; производные образованы от других частей речи и легко спутать с ними: в течение часа (предлог, можно заменить «на протяжении») — в течении реки (существительное «течение» с предлогом «в», можно вставить слово: в спокойном течении); несмотря на дождь (предлог, можно заменить «вопреки») — не смотря по сторонам (деепричастие, можно заменить «не глядя»).',
      'Союз связывает однородные члены предложения или части сложного предложения и не относится ни к одному конкретному слову. Сочинительные союзы (и, а, но, или, тоже, также) связывают равноправные части. Подчинительные союзы (потому что, чтобы, если, хотя, когда) присоединяют придаточную часть к главной. Союз чтобы отличают от местоимения с частицей что бы по возможности переставить/убрать частицу бы: чтобы успеть — переставить нельзя (союз); что бы почитать — можно сказать «что почитать» (частица бы у местоимения).',
      'Частица вносит в предложение дополнительный смысловой или эмоциональный оттенок, не связывая при этом слова и не выражая зависимости. Формообразующие частицы (бы, да, пусть, пускай) участвуют в образовании форм наклонения. Смысловые частицы делятся по значению: отрицательные (не, ни), вопросительные (ли, разве, неужели), усилительные (даже, ведь, уж), указательные (вот, вон), ограничительные (только, лишь).'
    ],
    coverPrompt:
      'Minimalist flat illustration of small connector puzzle pieces linking larger word-shaped blocks together, muted pastel palette, no readable text',
    cheatSheetLines: [
      'Предлог — перед сущ./местоим./числит., выражает зависимость: в школу, о друге, несмотря на дождь.',
      'Производный предлог vs самостоятельная часть речи: в течение часа (предлог) — в течении реки (сущ. + предлог, можно вставить слово).',
      'Несмотря на (предлог, = вопреки) — не смотря по сторонам (деепричастие, = не глядя).',
      'Союз связывает однородные члены/части сложного предложения: сочинительные (и, а, но), подчинительные (потому что, чтобы, если, когда).',
      'Чтобы/что бы: союз не разбивается (чтобы успеть), частицу бы можно убрать/переставить у местоимения (что бы почитать -> что почитать).',
      'Частица вносит смысловой оттенок, не связывает слова: отрицательные (не, ни), вопросительные (ли, разве), усилительные (даже, ведь), указательные (вот, вон), ограничительные (только, лишь).',
      'Формообразующие частицы (бы, пусть, пускай, да) участвуют в образовании наклонения: сделал бы, пусть придёт.'
    ],
    summaryLine: 'Предлог связывает слово с другими (перед сущ./местоим./числит.), союз связывает части предложения, частица вносит смысловой оттенок — служебные части речи не члены предложения.',
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
        instruction: 'Найдите в предложении союз',
        tokens: [
          {text: 'Он', correct: false},
          {text: 'и', correct: true},
          {text: 'она', correct: false},
          {text: 'пришли', correct: false},
          {text: 'вместе', correct: false}
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
        instruction: 'Найдите в предложении частицу',
        tokens: [
          {text: 'Только', correct: true},
          {text: 'он', correct: false},
          {text: 'один', correct: false},
          {text: 'остался', correct: false},
          {text: 'в', correct: false},
          {text: 'классе', correct: false}
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
          {text: 'Он', correct: false},
          {text: 'и', correct: true},
          {text: 'она', correct: false},
          {text: 'пришли', correct: false},
          {text: 'вместе', correct: false}
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
        instruction: 'Найдите в предложении частицу',
        tokens: [
          {text: 'Только', correct: true},
          {text: 'он', correct: false},
          {text: 'один', correct: false},
          {text: 'остался', correct: false},
          {text: 'в', correct: false},
          {text: 'классе', correct: false}
        ]
      },
      {
        kind: 'highlight',
        instruction: 'Найдите в предложении частицу',
        tokens: [
          {text: 'Даже', correct: true},
          {text: 'дети', correct: false},
          {text: 'поняли', correct: false},
          {text: 'эту', correct: false},
          {text: 'шутку', correct: false}
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
      }
    ]
  },
  {
    slug: 'interjections',
    ruName: 'Междометие и звукоподражательные слова',
    postTitle: 'Междометие и звукоподражательные слова: пунктуация и различие',
    explanation: [
      'Междометие — особая часть речи, которая не входит ни в самостоятельные, ни в служебные: она не называет предмет, признак или действие и не связывает слова, а прямо выражает чувства, эмоции или побуждение к действию, не называя их (ах! ой! увы! браво! эй!). Звукоподражательные слова стоят рядом с междометиями, но, в отличие от них, не выражают эмоций, а имитируют звуки природы, животных, предметов (мяу, гав-гав, тик-так, ку-ку, бух).',
      'Отличить междометие от звукоподражательного слова просто по смыслу: междометие можно заменить описанием чувства (ах! = выражение удивления или боли), звукоподражательное слово заменяется описанием источника звука (мяу = звук, который издаёт кошка). У обоих нет привычного лексического значения и грамматических категорий (рода, числа, падежа) — они не изменяются.',
      'На письме междометие или звукоподражательное слово обычно отделяется запятой от остальной части предложения: Ах, как здесь красиво! Мяу, — сказал кот и потянулся. Если междометие произносится с особой силой и выделяется интонационно, после него ставится восклицательный знак, а следующее слово пишется с заглавной буквы: Увы! Помочь уже нельзя.',
      'Важно не путать междометие с омонимичными словами других частей речи, совпадающими по звучанию. Слово ужас может быть существительным (Его охватил ужас) или междометием (Ужас, как я устал! — выражает эмоцию, не называет предмет). Слово батюшки — существительное во множественном числе (Дети слушали батюшек) или междометие удивления (Батюшки, кто пришёл!). Проверка: слово называет предмет и является членом предложения — это самостоятельная часть речи; слово только выражает эмоцию и не является членом предложения — это междометие.'
    ],
    coverPrompt:
      'Warm minimalist photo of a torn-paper speech bubble shape on textured cream paper, soft studio light, playful composition, no readable text',
    cheatSheetLines: [
      'Междометие выражает эмоцию/побуждение, не называя её: ах, ой, увы, браво, эй.',
      'Звукоподражательное слово имитирует звук: мяу, гав-гав, тик-так, ку-ку, бух.',
      'Оба не изменяются, не имеют рода/числа/падежа, не являются членами предложения.',
      'Запятая отделяет междометие от остальной части предложения: Ах, как здесь красиво!',
      'Сильная интонация — восклицательный знак после междометия, дальше — заглавная буква: Увы! Помочь нельзя.',
      'Омонимия с другими частями речи: Его охватил ужас (сущ., член предложения) — Ужас, как я устал! (междометие, эмоция).',
      'Проверка: называет предмет и является членом предложения -> не междометие; выражает только эмоцию -> междометие.'
    ],
    summaryLine: 'Междометие выражает эмоцию, звукоподражательное слово имитирует звук; оба не изменяются и обычно выделяются запятой или восклицательным знаком.',
    shortTestTitle: 'Междометие и звукоподражательные слова: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Ах, как здесь красиво! — что выражает «ах»?', options: ['эмоцию (междометие)', 'звук (звукоподражание)'], correct: 0},
      {kind: 'choose', question: 'Мяу, — сказал кот — что выражает «мяу»?', options: ['эмоцию (междометие)', 'звук (звукоподражание)'], correct: 1},
      {kind: 'choose', question: 'Нужна ли запятая: «Увы(,) помочь нельзя»?', options: ['да', 'нет'], correct: 0},
      {kind: 'choose', question: 'Его охватил ужас — «ужас» здесь существительное или междометие (называет предмет, член предложения)?', options: ['существительное', 'междометие'], correct: 0},
      {kind: 'choose', question: 'Ужас, как я устал! — «ужас» здесь существительное или междометие (выражает эмоцию)?', options: ['существительное', 'междометие'], correct: 1},
      {kind: 'choose', question: 'Тик-так — это междометие или звукоподражательное слово?', options: ['междометие', 'звукоподражательное слово'], correct: 1}
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
      {kind: 'choose', question: 'Нужна ли запятая: «Ах(,) какая красота»?', options: ['да', 'нет'], correct: 0},
      {kind: 'choose', question: 'Бух, — раздалось за дверью — междометие или звукоподражание (имитация звука падения)?', options: ['междометие', 'звукоподражание'], correct: 1},
      {kind: 'choose', question: 'Караул! Помогите скорее! — междометие или звукоподражание?', options: ['междометие', 'звукоподражание'], correct: 0},
      {kind: 'choose', question: 'Хи-хи послышалось из угла комнаты — междометие или звукоподражание (имитация смеха)?', options: ['междометие', 'звукоподражание'], correct: 1}
    ]
  }
]

// ───────────────────────── main ─────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}. Run seedUsers.ts first.`)

  const parent = await prisma.category.findUniqueOrThrow({where: {slug: 'morphology'}})

  const report: {
    categories: {slug: string; id: string; isNew: boolean}[]
    topics: {slug: string; postId?: string; shortTestId?: string; largeTestId?: string; cheatSheetUrl?: string; skipped: boolean}[]
    summaryPdfUrl?: string
  } = {categories: [], topics: []}

  // ── categories ──
  const categoryIds = new Map<string, string>()

  const partsOfSpeech = await prisma.category.findUniqueOrThrow({where: {slug: 'parts-of-speech'}})
  const participlesGerunds = await prisma.category.findUniqueOrThrow({where: {slug: 'participles-gerunds'}})
  categoryIds.set('parts-of-speech', partsOfSpeech.id)
  categoryIds.set('participles-gerunds', participlesGerunds.id)
  report.categories.push({slug: 'parts-of-speech', id: partsOfSpeech.id, isNew: false})
  report.categories.push({slug: 'participles-gerunds', id: participlesGerunds.id, isNew: false})

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

    // тесты — идемпотентно: переиспользуем, если прошлый прогон уже создал их без поста.
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
    const coverUrl = await uploadBuffer(coverBuffer, 'russian-course-images', 'png', teacher.id, 'image/png')
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
    'Морфология — оглавление блока',
    TOPICS.map((t) => ({name: t.ruName, line: t.summaryLine}))
  )
  const summaryUrl = await uploadBuffer(summaryBuffer, 'russian-course-cheatsheets', 'pdf', teacher.id, 'application/pdf')
  report.summaryPdfUrl = summaryUrl
  console.log(`\n+ сводный PDF блока «Морфология»: ${summaryUrl}`)

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
