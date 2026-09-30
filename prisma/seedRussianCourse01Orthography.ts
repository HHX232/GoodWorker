/**
 * Seed: блок «Орфография» курса «Русский язык» (тикет 01, .autopilot/russian-course/).
 * Идемпотентно: категории — upsert по slug; посты/тесты темы — пропускаются, если
 * пост с этим заголовком в этой категории уже существует (не плодит дубли на повторный запуск).
 *
 * Run: npx tsx prisma/seedRussianCourse01Orthography.ts
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
// 'nano-banana-2' does not exist in the live velsvisual model catalog (verified via
// `velsvisual models --refresh --json`); 'google/nano-banana' is the current recommended
// image model (`velsvisual recommend image --refresh`).
const IMAGE_MODEL = 'google/nano-banana'
const COVERS_DIR = path.join(process.cwd(), '.tmp-russian-course-covers')

// ───────────────────────── small id/content helpers ─────────────────────────

let _uidCounter = 0
function uid() {
  return `rc01-${Date.now()}-${++_uidCounter}`
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
// (confirmed by reading src/shared/ui/inputs/InputTaskGapComponent/InputGapNode.tsx +
// src/features/Tasks/TaskResult/scoreBlock.ts — not guessed from the type name).
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

type BlockSpec =
  | {kind: 'choose'; question: string; options: string[]; correct: number}
  | {kind: 'fill'; parts: FillPart[]}

function buildTestBlock(spec: BlockSpec) {
  return spec.kind === 'choose'
    ? chooseBlock(spec.question, spec.options, spec.correct)
    : fillTextBlock(spec.parts)
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

const NEW_CATEGORIES: {slug: string; translations: Record<'ru' | 'en' | 'hi' | 'zh', string>}[] = [
  {
    slug: 'unstressed-vowels-root',
    translations: {
      ru: 'Безударные гласные в корне',
      en: 'Unstressed Vowels in the Root',
      hi: 'मूल शब्द में अस्वरित स्वर',
      zh: '词根中的非重读元音'
    }
  },
  {
    slug: 'hard-soft-signs',
    translations: {
      ru: 'Ъ и Ь: разделительные и обозначающие мягкость',
      en: 'The Hard and Soft Signs: Separating and Softening',
      hi: 'कठोर और मृदु चिह्न: विभाजक और मृदुता-सूचक',
      zh: '硬音符与软音符：分隔符号与软化符号'
    }
  },
  {
    slug: 'ne-ni-spelling',
    translations: {
      ru: 'НЕ и НИ с разными частями речи',
      en: 'The Particles "Не" and "Ни" with Different Parts of Speech',
      hi: 'विभिन्न शब्द-भेदों के साथ "не" और "ни" कण',
      zh: '"не"与"ни"在不同词性中的拼写'
    }
  },
  {
    slug: 'n-nn-spelling',
    translations: {
      ru: 'Н и НН в разных частях речи',
      en: 'Single and Double "Н" in Different Parts of Speech',
      hi: 'विभिन्न शब्द-भेदों में एकल और द्वित्व "н"',
      zh: '不同词性中"н"与"нн"的拼写'
    }
  },
  {
    slug: 'hyphenation-rules',
    translations: {
      ru: 'Слитное, дефисное и раздельное написание',
      en: 'Solid, Hyphenated, and Separate Spelling',
      hi: 'संयुक्त, हाइफ़नयुक्त और पृथक वर्तनी',
      zh: '连写、连字符书写与分写规则'
    }
  },
  {
    slug: 'endings-spelling',
    translations: {
      ru: 'Правописание падежных и личных окончаний',
      en: 'Spelling of Case and Personal Endings',
      hi: 'कारक और पुरुषवाचक अंतों की वर्तनी',
      zh: '格尾变化与人称词尾的拼写'
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
    slug: 'spelling-words',
    ruName: 'Правописание слов',
    postTitle: 'Правописание слов: словарь-минимум для грамотного письма',
    explanation: [
      'Не все написания в русском языке подчиняются единому правилу — часть слов нужно просто запомнить, свериться со словарём или почувствовать по смысловой близости к языку-источнику. Такие слова называют словарными: в них написание нельзя проверить, подобрав однокоренное слово под ударением.',
      'Ниже — минимум из 40 слов, в которых чаще всего ошибаются. У каждого — краткая пометка, что именно проверять: двойную согласную, непроверяемую гласную или редкое сочетание букв.',
      'аккуратный (двойная к), аппетит (двойная п), балкон (непроверяемая а), вестибюль (непроверяемая е), винегрет (е, не и — от франц. vinaigrette), галерея (непроверяемая е), гостиница (непроверяемая о), дилетант (непроверяемая и), дистанция (непроверяемая и), единица (непроверяемая е), желание (непроверяемая е), жюри (ю после ж — исключение), здание (непроверяемая а), здоровье (з — часть корня, не приставка), изображение (непроверяемая о), интеллигенция (двойная л, непроверяемая и), искусство (двойная с), каникулы (непроверяемая а), календарь (непроверяемая а), коридор (непроверяемая о), комментарий (двойная м), компьютер (непроверяемая о), конверт (непроверяемая о), лабиринт (непроверяемая а), миллион (двойная л), оригинальный (непроверяемая и), панорама (непроверяемая а), пассажир (двойная с), президент (непроверяемая е), привилегия (непроверяемая и и е), профессия (двойная с), пьеса (непроверяемая ь и е), режиссёр (двойная с, ё не е), рюкзак (непроверяемая ю), тротуар (непроверяемая о), фестиваль (непроверяемая е), чемодан (непроверяемая е), экспресс (двойная с), эффект (двойная ф), вокзал (непроверяемая о), собака (непроверяемая о).'
    ],
    coverPrompt:
      'Warm editorial still life on a wooden desk: an open notebook with handwriting, a fountain pen, scattered dictionary pages, soft natural window light, cozy study atmosphere, no readable text',
    cheatSheetLines: [
      'Словарные слова не проверяются ударением — написание нужно запомнить или сверить со словарём.',
      'Двойные согласные: аккуратный, аппетит, интеллигенция, искусство, миллион, пассажир, режиссёр, эффект.',
      'Непроверяемая гласная в корне: балкон, вокзал, гостиница, календарь, коридор, панорама, тротуар, чемодан.',
      'Редкие буквосочетания: жюри (ю после ж) — исключение из правила «жи-ши, ча-ща, чу-щу».',
      'З в начале корня, а не приставка: здание, здоровье, здесь — «з» исторически срослась с корнем.',
      'Иноязычные слова с непривычным звучанием: дилетант, дистанция, привилегия, профессия, президент.'
    ],
    summaryLine: 'Словарные написания без единого правила: запоминаем через частое чтение и словарь.',
    shortTestTitle: 'Правописание слов: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['востибюль', 'вестибюль', 'вестибюл'], correct: 1},
      {kind: 'choose', question: 'Выберите слово, написанное верно', options: ['пассажир', 'посажир', 'пассожир'], correct: 0},
      {kind: 'fill', parts: ['к', {gap: 'о'}, 'нверт']},
      {kind: 'fill', parts: ['лаб', {gap: 'и'}, 'ринт']},
      {kind: 'fill', parts: ['п', {gap: 'а'}, 'ссажир']},
      {kind: 'fill', parts: ['ор', {gap: 'и'}, 'гинальный']}
    ],
    largeTestTitle: 'Правописание слов: большой тест на словарные слова',
    largeTestBlocks: [
      {kind: 'fill', parts: ['к', {gap: 'о'}, 'ридор']},
      {kind: 'fill', parts: ['в', {gap: 'е'}, 'стибюль']},
      {kind: 'fill', parts: ['б', {gap: 'а'}, 'лкон']},
      {kind: 'fill', parts: ['к', {gap: 'а'}, 'никулы']},
      {kind: 'fill', parts: ['р', {gap: 'е'}, 'жиссёр']},
      {kind: 'fill', parts: ['тр', {gap: 'о'}, 'туар']},
      {kind: 'fill', parts: ['ф', {gap: 'е'}, 'стиваль']},
      {kind: 'fill', parts: ['в', {gap: 'о'}, 'кзал']},
      {kind: 'fill', parts: ['г', {gap: 'о'}, 'стиница']},
      {kind: 'fill', parts: ['ж', {gap: 'ю'}, 'ри']},
      {kind: 'fill', parts: ['к', {gap: 'а'}, 'лендарь']},
      {kind: 'fill', parts: ['к', {gap: 'о'}, 'мпьютер']},
      {kind: 'fill', parts: ['п', {gap: 'а'}, 'норама']},
      {kind: 'fill', parts: ['ч', {gap: 'е'}, 'модан']}
    ]
  },
  {
    slug: 'prefixes-suffixes',
    ruName: 'Приставки и суффиксы',
    postTitle: 'Приставки на З/С и приставки ПРЕ-/ПРИ-',
    explanation: [
      'Приставки, оканчивающиеся на З или С (без-/бес-, из-/ис-, раз-/рас-, воз-/вос-, низ-/нис-, чрез-/чрес-, вз-/вс-), подчиняются фонетическому правилу: перед звонким согласным пишем З, перед глухим — С. Сравните: безопасный (перед гласной — З) и бесполезный (перед глухим п — С); разбить (перед звонким б — З) и распилить (перед глухим п — С).',
      'Не путайте это правило с приставкой С-, которая пишется всегда одинаково независимо от следующего звука: сделать, сбежать, сгореть — здесь С не подчиняется правилу «на з/с». Отдельно стоят слова здание, здоровье, здесь, ни зги — в них «з» исторически срослась с корнем, приставки здесь нет вовсе.',
      'Приставка ПРИ- пишется, если в слове есть значение приближения (прибежать), присоединения (пришить), неполноты действия (приоткрыть), близости (пришкольный) или доведения действия до конца (придумать). Приставка ПРЕ- пишется, если значение близко к «очень» (превосходный = очень хороший) или к приставке ПЕРЕ- (преступить = переступить закон).',
      'В части слов значение приставки стёрлось, и написание нужно запомнить: пренебрегать, препятствие, президент, преследовать — но приключение, привет, приятный, приоритет. Такие слова — исключения, которые не выводятся по смыслу и требуют словаря.'
    ],
    coverPrompt:
      'Minimalist flat editorial illustration of building blocks and puzzle pieces assembling into an abstract word shape, soft pastel palette, no readable text',
    cheatSheetLines: [
      'Приставки на З/С: перед звонким — З (безопасный, разбить), перед глухим — С (бесполезный, распилить).',
      'Приставка С- пишется всегда одинаково: сделать, сбежать, сгореть — правило «на з/с» здесь не действует.',
      'Здание, здоровье, здесь, ни зги — «з» это часть корня, а не приставка.',
      'ПРИ- = приближение, присоединение, неполнота действия, близость, доведение до конца: прибежать, пришить, приоткрыть, пришкольный, придумать.',
      'ПРЕ- = «очень» или «пере-»: превосходный (=очень хороший), преступить (=переступить).',
      'Исключения на запоминание: пренебрегать, препятствие, президент, преследовать; приключение, привет, приятный.'
    ],
    summaryLine: 'Приставки на З/С — по звонкости/глухости следующего звука; ПРЕ-/ПРИ- — по значению, часть слов запоминаем отдельно.',
    shortTestTitle: 'Приставки на З/С и ПРЕ-/ПРИ-: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['безопасный', 'бесопасный', 'безъопасный'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['расписание', 'разписание', 'расспиание'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['здоровье', 'сдоровье', 'зздоровье'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['бесшумный', 'безшумный', 'бессшумный'], correct: 0},
      {kind: 'choose', question: 'Какое слово написано верно?', options: ['чрезмерный', 'чресмерный', 'чрезьмерный'], correct: 0},
      {kind: 'choose', question: '..думать историю — довести дело до конца. Какая приставка?', options: ['при-', 'пре-'], correct: 0}
    ],
    largeTestTitle: 'ПРЕ-/ПРИ-: большой тест на значение приставки',
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
      {kind: 'choose', question: 'Пр_вокзальная площадь — по смыслу «около вокзала». Какая буква?', options: ['и', 'е'], correct: 0}
    ]
  },
  {
    slug: 'unstressed-vowels-root',
    ruName: 'Безударные гласные в корне',
    postTitle: 'Безударные гласные в корне: три типа и как их различать',
    explanation: [
      'Безударная гласная в корне слова — одна из самых частых ошибок на письме, потому что на слух такие гласные звучат одинаково (о и а, е и и). Чтобы не ошибиться, нужно понять, к какому из трёх типов относится гласная: проверяемая, непроверяемая или чередующаяся.',
      'Проверяемые гласные проверяются ударением: нужно подобрать однокоренное слово или изменить форму так, чтобы спорная гласная оказалась под ударением. Вода проверяется словом воды, лесной — словом лес, слабый — словом слабость.',
      'Непроверяемые гласные — словарные: подобрать проверочное слово невозможно, потому что ни в одной форме гласная не бывает под ударением (собака, вагон, корзина). Их нужно запомнить или свериться со словарём.',
      'Чередующиеся гласные — самый сложный тип: в одном и том же корне гласная меняется по условию. Условием может быть ударение (гар-/гор-, зар-/зор-), следующая согласная (раст-/ращ-/рос-, лаг-/лож-, скак-/скоч-), суффикс -а- после корня (бир-/бер-, тир-/тер-, стил-/стел-) или значение слова (мак-/мок-, равн-/ровн-, плав-/плов-).'
    ],
    coverPrompt: 'Close-up photo of a chalkboard with faint chalk dust and an eraser, warm classroom light, blurred background, no readable text',
    cheatSheetLines: [
      'Проверяемая: подбираем однокоренное слово под ударением. Вода -> воды, лесной -> лес.',
      'Непроверяемая (словарная): собака, вагон, корзина, абрикос — запоминаем или ищем в словаре.',
      'Гар-/гор-, зар-/зор-: без ударения — а/о, под ударением — а. Загорать (гор), загар (гар).',
      'Раст-/ращ- / рос-: перед ст/щ — а (расти, выращенный), перед с — о (вырос). Искл.: росток, Ростов, отрасль.',
      'Лаг-/лож-: перед г — а (полагать), перед ж — о (положить).',
      'Бир-/бер-, тир-/тер-, стил-/стел-: если после корня суффикс -а- — и (собирать), если нет — е (соберу).',
      'Мак-/мок-: мак- «погружать» (обмакнуть перо), мок- «пропускать жидкость» (непромокаемый).',
      'Равн-/ровн-: равн- «одинаковый» (уравнение), ровн- «гладкий, прямой» (подровнять).'
    ],
    summaryLine: 'Проверяем ударением, запоминаем словарные, чередующиеся — по условию (ударение/согласная/суффикс/значение).',
    shortTestTitle: 'Безударные гласные в корне: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['в', {gap: 'о'}, 'да']},
      {kind: 'fill', parts: ['л', {gap: 'е'}, 'сной']},
      {kind: 'fill', parts: ['сл', {gap: 'а'}, 'бый']},
      {kind: 'fill', parts: ['с', {gap: 'о'}, 'бака']},
      {kind: 'fill', parts: ['к', {gap: 'о'}, 'рзина']},
      {kind: 'fill', parts: ['в', {gap: 'а'}, 'гон']}
    ],
    largeTestTitle: 'Безударные гласные в корне: большой тест на чередования',
    largeTestBlocks: [
      {kind: 'fill', parts: ['заг', {gap: 'о'}, 'рать']},
      {kind: 'fill', parts: ['заг', {gap: 'а'}, 'р']},
      {kind: 'fill', parts: ['з', {gap: 'а'}, 'ря']},
      {kind: 'fill', parts: ['з', {gap: 'о'}, 'рька']},
      {kind: 'fill', parts: ['выр', {gap: 'а'}, 'щенный']},
      {kind: 'fill', parts: ['выр', {gap: 'о'}, 'с']},
      {kind: 'fill', parts: ['отр', {gap: 'а'}, 'сль']},
      {kind: 'fill', parts: ['пол', {gap: 'а'}, 'гать']},
      {kind: 'fill', parts: ['пол', {gap: 'о'}, 'жить']},
      {kind: 'fill', parts: ['соб', {gap: 'и'}, 'рать']},
      {kind: 'fill', parts: ['соб', {gap: 'е'}, 'ру']},
      {kind: 'fill', parts: ['обм', {gap: 'а'}, 'кнуть']},
      {kind: 'fill', parts: ['непром', {gap: 'о'}, 'каемый']},
      {kind: 'fill', parts: ['ур', {gap: 'а'}, 'внение']}
    ]
  },
  {
    slug: 'hard-soft-signs',
    ruName: 'Ъ и Ь: разделительные и обозначающие мягкость',
    postTitle: 'Ъ и Ь: разделительные знаки и обозначение мягкости',
    explanation: [
      'Твёрдый знак (Ъ) и мягкий знак (Ь) не обозначают звуков, но играют важную роль на письме. Разделительный Ъ показывает, что согласный перед ним и гласный после него произносятся раздельно, с «йотом»: подъезд, объявление, разъяснить.',
      'Ъ пишется после приставки, которая оканчивается на согласную, перед корнем, начинающимся с Е, Ё, Ю или Я: въезд, съёмка, разъярённый. Такое же правило действует в сложных словах после числительных двух-, трёх-, четырёх-: двухъярусный, трёхъязычный. В некоторых заимствованных словах Ъ пишется после приставки, которая уже не ощущается как приставка: объект, инъекция, конъюнктура.',
      'Разделительный Ь пишется внутри корня или перед суффиксом (не после приставки!) перед гласными Е, Ё, И, Ю, Я: вьюга, семья, пьеса, воробьи, курьер. Его нельзя путать с Ь, который обозначает мягкость согласного на конце слова или перед твёрдым согласным: конь, мельник, пальто.',
      'Отдельное правило — Ь после шипящих (ж, ш, ч, щ). Он пишется у существительных женского рода 3-го склонения (ночь, мышь, дочь), у глаголов на -ешь, в повелительном наклонении и в инфинитиве на -чь (пишешь, отрежь, беречь), у большинства наречий (настежь, сплошь — искл. уж, замуж, невтерпёж). Он не пишется у существительных мужского рода (мяч, товарищ) и в родительном падеже множественного числа (много туч, дач).'
    ],
    coverPrompt: 'Macro photo of an old typewriter with one key highlighted, warm sepia tones, vintage academic atmosphere, no readable text',
    cheatSheetLines: [
      'Ъ — после приставки на согласную перед Е, Ё, Ю, Я: подъезд, объявление, разъяснить, съёмка.',
      'Ъ — после двух-/трёх-/четырёх- перед Е,Ё,Ю,Я: двухъярусный. И в словах объект, инъекция, конъюнктура.',
      'Ь (разделительный) — внутри корня/перед суффиксом, НЕ после приставки: вьюга, семья, пьеса, курьер.',
      'Ь обозначает мягкость: конь, мельник, пальто, коньки — это другой случай, не разделительный.',
      'Ь после шипящих пишем: сущ. ж.р. 3 скл. (ночь), глаголы на -ешь/-чь (пишешь, беречь), наречия (настежь).',
      'Ь после шипящих НЕ пишем: сущ. м.р. (мяч), сущ. мн.ч. Р.п. (много туч), искл.-наречия (уж, замуж, невтерпёж).'
    ],
    summaryLine: 'Ъ — после приставки на согласный перед Е/Ё/Ю/Я; Ь — внутри корня перед той же группой букв, плюс отдельное правило Ь после шипящих.',
    shortTestTitle: 'Ъ и Ь: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['под', {gap: 'ъ'}, 'езд']},
      {kind: 'fill', parts: ['с', {gap: 'ъ'}, 'ёмка']},
      {kind: 'fill', parts: ['об', {gap: 'ъ'}, 'явление']},
      {kind: 'fill', parts: ['в', {gap: 'ь'}, 'юга']},
      {kind: 'fill', parts: ['сем', {gap: 'ь'}, 'я']},
      {kind: 'fill', parts: ['пал', {gap: 'ь'}, 'то']}
    ],
    largeTestTitle: 'Ъ и Ь: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['раз', {gap: 'ъ'}, 'яснить']},
      {kind: 'fill', parts: ['двух', {gap: 'ъ'}, 'ярусный']},
      {kind: 'fill', parts: ['ин', {gap: 'ъ'}, 'екция']},
      {kind: 'fill', parts: ['об', {gap: 'ъ'}, 'ект']},
      {kind: 'fill', parts: ['кур', {gap: 'ь'}, 'ер']},
      {kind: 'fill', parts: ['п', {gap: 'ь'}, 'еса']},
      {kind: 'fill', parts: ['ноч', {gap: 'ь'}, '']},
      {kind: 'fill', parts: ['вороб', {gap: 'ь'}, 'и']},
      {kind: 'fill', parts: ['раз', {gap: 'ъ'}, 'ярённый']},
      {kind: 'fill', parts: ['из', {gap: 'ъ'}, 'ян']},
      {kind: 'choose', question: 'Нужен ли Ь: «много туч..» (Р.п. мн.ч. сущ.)?', options: ['нужен', 'не нужен'], correct: 1},
      {kind: 'choose', question: 'Нужен ли Ь: «отреж..!» (повелительное наклонение)?', options: ['нужен', 'не нужен'], correct: 0},
      {kind: 'choose', question: 'Нужен ли Ь: «горяч.. суп» (краткое прилагательное, м.р.)?', options: ['нужен', 'не нужен'], correct: 1},
      {kind: 'choose', question: 'Нужен ли Ь: «стеречь» (инфинитив на -чь)?', options: ['нужен', 'не нужен'], correct: 0}
    ]
  },
  {
    slug: 'ne-ni-spelling',
    ruName: 'НЕ и НИ с разными частями речи',
    postTitle: 'НЕ и НИ: слитно, раздельно и с какими частями речи',
    explanation: [
      'Частицы НЕ и НИ путают даже опытных пишущих, потому что решение зависит сразу от нескольких факторов: части речи, наличия зависимых слов, противопоставления и даже ударения. Разберём НЕ по частям речи, а затем — когда вместо неё нужна НИ.',
      'С существительными, прилагательными и наречиями на -о частица НЕ пишется слитно, если слово не употребляется без НЕ (ненависть, нелепый) или если его можно заменить синонимом без НЕ (неправда = ложь). Раздельно — при явном противопоставлении с союзом А (не правда, а ложь) и при словах вовсе не, далеко не, отнюдь не (вовсе не радостная встреча).',
      'С глаголами и деепричастиями НЕ пишется раздельно почти всегда (не знать, не читая) — слитно только если слово вообще не употребляется без НЕ (негодовать, ненавидеть). С причастиями — слитно без зависимых слов и без противопоставления (несделанная работа), но раздельно с зависимым словом (не сделанная вовремя работа) и в краткой форме (работа не сделана).',
      'Частица НИ усиливает уже имеющееся отрицание или подчёркивает полноту утверждения в придаточных с как ни, кто бы ни, что бы ни: как я ни старался; кто бы ни пришёл. В отрицательных местоимениях и наречиях выбор между НЕ и НИ определяется ударением: некогда (под ударением — недостаток времени) и никогда (без ударения — полное отрицание).'
    ],
    coverPrompt: 'Minimalist illustration of two opposite arrows at a foggy crossroads, symbolic of choice and negation, muted color palette, no text',
    cheatSheetLines: [
      'НЕ слитно: слово не употребляется без НЕ (ненависть) или заменяется синонимом (неправда = ложь).',
      'НЕ раздельно: есть противопоставление с А (не правда, а ложь) или усилители вовсе не, далеко не, отнюдь не.',
      'НЕ с глаголом/деепричастием — почти всегда раздельно: не знать, не читая. Искл.: негодовать, ненавидеть.',
      'НЕ с причастием: слитно без завис. слов (несделанная), раздельно с завис. словом или в краткой форме (не сделана).',
      'НИ усиливает отрицание или полноту утверждения: как ни старался; кто бы ни пришёл; ни облачка.',
      'Отрицательные местоимения/наречия: под ударением — не (некогда), без ударения — ни (никогда).'
    ],
    summaryLine: 'НЕ — слитно/раздельно по части речи, синониму и противопоставлению; НИ — усиление отрицания и полнота утверждения в придаточных.',
    shortTestTitle: 'НЕ и НИ: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Это была (не)правда, а ложь. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Ему было (не)весело на празднике (=грустно). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0},
      {kind: 'choose', question: 'На улице (не)было ни души. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Дорога оказалась (не)длинной, а короткой. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Их сын был (не)годяй (слово без «не» не употребляется). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0},
      {kind: 'choose', question: 'Работа была сделана (не)брежно (без «не» не употребляется). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0}
    ],
    largeTestTitle: 'НЕ и НИ: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Как я (ни)старался, ничего не вышло. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'На небе (ни)облачка. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Куда (ни)глянь — всюду снег. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Это была вовсе (не)радостная встреча. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Задача (не)решена до сих пор (краткое причастие). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: '(Не)сделанная вовремя работа принесла проблемы (есть зависимое слово). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Написанное, но (не)подписанное письмо лежало на столе (противопоставление). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Кто бы (ни)пришёл, дверь всегда открыта. НЕ или НИ?', options: ['не', 'ни'], correct: 1},
      {kind: 'choose', question: 'Ему было (некуда/никуда) пойти. Как правильно (отрицательное наречие, без ударения)?', options: ['некуда', 'никуда'], correct: 0},
      {kind: 'choose', question: 'Мне (некогда/никогда) было скучать (под ударением — недостаток времени). Как правильно?', options: ['некогда', 'никогда'], correct: 0},
      {kind: 'choose', question: 'Я (не)годовал из-за несправедливости (слово без «не» не употребляется). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 0},
      {kind: 'choose', question: 'Это был вовсе (не)высокий забор (есть усилитель «вовсе»). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Отнюдь (не)лёгкая задача досталась команде. Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1},
      {kind: 'choose', question: 'Дверь была (не)заперта (краткое причастие). Слитно или раздельно?', options: ['слитно', 'раздельно'], correct: 1}
    ]
  },
  {
    slug: 'n-nn-spelling',
    ruName: 'Н и НН в разных частях речи',
    postTitle: 'Н и НН: алгоритм для причастий и отглагольных прилагательных',
    explanation: [
      'Выбор между одной и двумя буквами Н — одна из самых формализуемых тем русской орфографии: есть чёткий алгоритм, который снимает почти все сомнения. Разберём его по шагам.',
      'Шаг 1: если перед вами краткое причастие — пишем одну Н всегда, без исключений: работа сделана, дети избалованы. Шаг 2: если это краткое прилагательное — Н столько же, сколько в полной форме: длинная → длинна, туманная → туманна.',
      'Шаг 3: для полного причастия или отглагольного прилагательного НН пишется, если есть хотя бы одно из условий: приставка, кроме НЕ (скошенный), зависимое слово (жаренный на масле картофель), суффикс -ова-/-ева-/-ирова- (маринованный) или образование от глагола совершенного вида (решённая задача). Если ни одного условия нет — пишем одну Н: жареный картофель, крашеный пол, стриженый мальчик.',
      'Есть традиционные исключения, которые запоминаются отдельно: раненый, названый брат, посажёный отец, прощёное воскресенье, приданое — одна Н несмотря на приставку или вид глагола. А слово ветреный — исключение с одной Н, но с приставкой (безветренный) правило снова работает и пишется НН.',
      'Для прилагательных, образованных от существительных, действуют суффиксы: -ённ-/-енн- дают НН (соломенный, клюквенный), а -ан-/-ян-/-ин- дают одну Н (кожаный, серебряный, гусиный). Исключения на запоминание: деревянный, оловянный, стеклянный — две Н. В наречиях на -о и существительных, образованных от прилагательного или причастия, сохраняется столько Н, сколько было в производящем слове: путано (от путаный), но испуганно (от испуганный).'
    ],
    coverPrompt: 'Abstract editorial photo of two parallel wooden pencils lying on lined paper, soft daylight, minimalist composition, no readable text',
    cheatSheetLines: [
      'Краткое причастие — всегда одна Н: работа сделана, дети избалованы.',
      'Краткое прилагательное — столько Н, сколько в полной форме: длинная -> длинна.',
      'Полное причастие/отглаг. прилагательное — НН, если есть приставка (кроме не-), завис. слово, суфф. -ова-/-ева-/-ирова- или глагол сов. вида: скошенный, жаренный на масле, маринованный, решённая.',
      'Без этих условий — одна Н: жареный, крашеный, стриженый.',
      'Исключения на одну Н: раненый, названый брат, посажёный отец, прощёное воскресенье, приданое, ветреный.',
      'Суффиксы прилагательных от сущ.: -ённ-/-енн- дают НН (соломенный); -ан-/-ян-/-ин- дают Н (кожаный, гусиный). Искл.: деревянный, оловянный, стеклянный.',
      'Наречия на -о и сущ. от прилаг./прич. сохраняют число Н производящего слова: путано, но испуганно.'
    ],
    summaryLine: 'Краткое причастие — всегда Н; полное — НН при приставке/завис. слове/суфф. -ова-/сов. виде, иначе Н; часть слов — исключения.',
    shortTestTitle: 'Н и НН: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['жаре', {gap: 'нн'}, 'ый на масле картофель']},
      {kind: 'fill', parts: ['жаре', {gap: 'н'}, 'ый картофель']},
      {kind: 'fill', parts: ['реше', {gap: 'нн'}, 'ая задача']},
      {kind: 'fill', parts: ['краше', {gap: 'н'}, 'ый пол']},
      {kind: 'fill', parts: ['клюкве', {gap: 'нн'}, 'ый морс']},
      {kind: 'fill', parts: ['серебря', {gap: 'н'}, 'ый кубок']}
    ],
    largeTestTitle: 'Н и НН: большой тест на исключения',
    largeTestBlocks: [
      {kind: 'fill', parts: ['асфальтирова', {gap: 'нн'}, 'ый двор']},
      {kind: 'fill', parts: ['ветре', {gap: 'н'}, 'ый день']},
      {kind: 'fill', parts: ['безветре', {gap: 'нн'}, 'ый вечер']},
      {kind: 'fill', parts: ['деревя', {gap: 'нн'}, 'ый стол']},
      {kind: 'fill', parts: ['гуси', {gap: 'н'}, 'ый пух']},
      {kind: 'fill', parts: ['испуга', {gap: 'нн'}, 'ая птица']},
      {kind: 'fill', parts: ['краше', {gap: 'нн'}, 'ый вчера забор']},
      {kind: 'fill', parts: ['избалова', {gap: 'н'}, 'а']},
      {kind: 'fill', parts: ['дли', {gap: 'нн'}, 'а']},
      {kind: 'fill', parts: ['пута', {gap: 'н'}, 'о']},
      {kind: 'fill', parts: ['взволнова', {gap: 'нн'}, 'о']},
      {kind: 'fill', parts: ['гости', {gap: 'н'}, 'ая']},
      {kind: 'fill', parts: ['зва', {gap: 'н'}, 'ый вечер']},
      {kind: 'fill', parts: ['назва', {gap: 'н'}, 'ый брат']}
    ]
  },
  {
    slug: 'hyphenation-rules',
    ruName: 'Слитное, дефисное и раздельное написание',
    postTitle: 'Слитно, через дефис или раздельно: разбираем по частям речи',
    explanation: [
      'Слитное, дефисное и раздельное написание регулируется разными правилами для разных частей речи — единой универсальной инструкции нет, но есть закономерности для существительных, прилагательных, наречий и служебных слов.',
      'Сложные существительные пишутся слитно, если образованы с соединительной гласной о/е (пароход) или это сложносокращённое слово (завуч). Через дефис — если оба компонента самостоятельные существительные без соединительной гласной (диван-кровать, генерал-майор). Пол- пишется слитно перед согласной, кроме л (полчаса, полдороги), и через дефис перед гласной, буквой л и заглавной буквой (пол-лимона, пол-Москвы).',
      'Сложные прилагательные пишутся слитно, если образованы от подчинительного словосочетания (железнодорожный ← железная дорога), и через дефис — если от сочинительного сочетания равноправных понятий (русско-английский = русский и английский) или для обозначения оттенка цвета/качества (тёмно-синий, горько-солёный).',
      'Наречия чаще всего пишутся слитно (вдвое, сгоряча, наконец), но через дефис — с приставкой по- и суффиксами -ому/-ему/-и (по-новому, по-дружески), с приставкой в-/во- у порядковых числительных (во-первых), с частицами -то/-либо/-нибудь/кое- (кое-как). Раздельно пишутся наречные сочетания, сохранившие падежную форму существительного (без устали, на скаку) — их лучше сверять по словарю.',
      'Производные предлоги (в течение, вследствие, ввиду, несмотря на) различаются с существительным и предлогом по контексту: в течение часа (предлог, значение времени) — но в течении реки (существительное с предлогом, можно вставить слово). Частица -таки пишется через дефис после глаголов, наречий и частиц: всё-таки, опять-таки.'
    ],
    coverPrompt: 'Editorial photo of a hyphen-shaped paper cutout resting on a wooden table with scattered wooden letter tiles, warm light, no readable text',
    cheatSheetLines: [
      'Сложные сущ.: слитно с соединит. о/е (пароход); дефис — два самост. сущ. без гласной (диван-кровать).',
      'Пол-: слитно перед согласной кроме л (полчаса); дефис перед гласной/л/заглавной буквой (пол-лимона, пол-Москвы).',
      'Сложные прилаг.: слитно от подчинит. словосочетания (железнодорожный); дефис — от сочинит. (русско-английский) или оттенок (тёмно-синий).',
      'Наречия с по-...-ому/-ему/-и — дефис (по-новому); с в-/во- у числит. — дефис (во-первых); с кое-/-то/-либо/-нибудь — дефис (кое-как).',
      'Производные предлоги (в течение, вследствие, ввиду) — отличать от сущ. с предлогом по контексту.',
      'Частица -таки — дефис после глагола/наречия/частицы: всё-таки, опять-таки.'
    ],
    summaryLine: 'Слитно/дефис/раздельно — правило своё для каждой части речи: сущ. и прил. по составу, наречия по приставке/суффиксу, предлоги по контексту.',
    shortTestTitle: 'Слитно/дефис/раздельно: короткая проверка',
    shortTestBlocks: [
      {kind: 'choose', question: 'Выберите верный вариант', options: ['во-первых', 'вопервых', 'во первых'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['кое-как', 'коекак', 'кое как'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['вдвое', 'в-двое', 'в двое'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['всё-таки', 'всётаки', 'всё таки'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['в течение часа', 'втечение часа', 'в течении часа'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['несмотря на дождь', 'не смотря на дождь', 'несмотрянадождь'], correct: 0}
    ],
    largeTestTitle: 'Слитно/дефис/раздельно: большой тест',
    largeTestBlocks: [
      {kind: 'choose', question: 'Выберите верный вариант', options: ['плащ-палатка', 'плащпалатка', 'плащ палатка'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['диван-кровать', 'диванкровать', 'диван кровать'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['юго-запад', 'югозапад', 'юго запад'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['генерал-майор', 'генералмайор', 'генерал майор'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['полчаса', 'пол-часа', 'пол часа'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['полдороги', 'пол-дороги', 'пол дороги'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['пол-лимона', 'полулимона', 'пол лимона'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['пол-апельсина', 'полапельсина', 'пол апельсина'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['пол-Москвы', 'полМосквы', 'пол Москвы'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['тёмно-синий', 'тёмносиний', 'тёмно синий'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['горько-солёный', 'горькосолёный', 'горько солёный'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['железнодорожный', 'железно-дорожный', 'железно дорожный'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['русско-английский', 'русскоанглийский', 'русско английский'], correct: 0},
      {kind: 'choose', question: 'Выберите верный вариант', options: ['по-дружески', 'подружески', 'по дружески'], correct: 0}
    ]
  },
  {
    slug: 'endings-spelling',
    ruName: 'Правописание падежных и личных окончаний',
    postTitle: 'Падежные окончания существительных и личные окончания глаголов',
    explanation: [
      'Безударные окончания существительных, прилагательных и глаголов часто пишутся не так, как слышатся, — их нужно проверять по правилу, а не на слух.',
      'У существительных окончание зависит от склонения. 1-е склонение (женский и мужской род на -а/-я) в родительном, дательном и предложном падежах единственного числа имеет окончание -е (к воде, о стране), кроме слов на -ия, где в дательном и предложном пишется -и (о линии, к армии). 2-е склонение (мужской род без окончания, средний род на -о/-е) в предложном падеже имеет окончание -е (о столе), кроме слов на -ий/-ие, где пишется -и (о планетарии, о здании). 3-е склонение (женский род с Ь на конце) во всех падежах, кроме именительного и винительного, имеет окончание -и (к ночи, о степи).',
      'У прилагательных окончание проверяется вопросом: окончание вопроса подсказывает окончание слова. В синем небе — каком? — небе, значит -ем. О лучшей подруге — какой? — значит -ей.',
      'У глаголов безударное личное окончание зависит от спряжения. Чтобы его определить, глагол ставят в неопределённую форму. II спряжение — все глаголы на -ить (кроме брить, стелить, зиждиться) и 11 глаголов-исключений: гнать, держать, смотреть, видеть, дышать, слышать, ненавидеть, вертеть, обидеть, терпеть, зависеть. У них окончания -ит/-ат(-ят): строишь, видит, дышат. Все остальные глаголы — I спряжение, окончания -ет/-ут(-ют): читаешь, борются, стелет.'
    ],
    coverPrompt: 'Photo of an open grammar textbook with a wooden ruler and a highlighter on a study table, soft morning light, cozy academic mood, no readable text',
    cheatSheetLines: [
      '1 скл. (Р./Д./П.п. ед.ч.) — окончание -е: к воде, о стране. Слова на -ия — -и: о линии, к армии.',
      '2 скл. (П.п.) — окончание -е: о столе. Слова на -ий/-ие — -и: о планетарии, о здании.',
      '3 скл. (ж.р. на Ь) — всегда -и, кроме И./В.п.: к ночи, о степи, в тетради.',
      'Прилагательное — окончание по вопросу: в синем небе — каком? — -ем; о лучшей подруге — какой? — -ей.',
      'II спряжение: глаголы на -ить (кроме брить, стелить, зиждиться) + 11 искл. (гнать, держать, смотреть, видеть, дышать, слышать, ненавидеть, вертеть, обидеть, терпеть, зависеть) — окончания -ит/-ат(-ят).',
      'I спряжение — все остальные глаголы, окончания -ет/-ут(-ют): читаешь, борются, стелет.'
    ],
    summaryLine: 'Окончания существительных — по склонению, прилагательных — по вопросу, глаголов — по спряжению (проверка через неопределённую форму).',
    shortTestTitle: 'Падежные и личные окончания: короткая проверка',
    shortTestBlocks: [
      {kind: 'fill', parts: ['о лини', {gap: 'и'}, '']},
      {kind: 'fill', parts: ['в син', {gap: 'ем'}, ' небе']},
      {kind: 'fill', parts: ['к лучш', {gap: 'ей'}, ' подруге']},
      {kind: 'fill', parts: ['на площад', {gap: 'и'}, '']},
      {kind: 'fill', parts: ['в здани', {gap: 'и'}, '']},
      {kind: 'fill', parts: ['о берег', {gap: 'е'}, '']}
    ],
    largeTestTitle: 'Личные окончания глаголов и падежные окончания: большой тест',
    largeTestBlocks: [
      {kind: 'fill', parts: ['ты пиш', {gap: 'ешь'}, '']},
      {kind: 'fill', parts: ['он вид', {gap: 'ит'}, '']},
      {kind: 'fill', parts: ['они бор', {gap: 'ются'}, '']},
      {kind: 'fill', parts: ['он стел', {gap: 'ет'}, '']},
      {kind: 'fill', parts: ['вы дыш', {gap: 'ите'}, '']},
      {kind: 'fill', parts: ['они гон', {gap: 'ят'}, '']},
      {kind: 'fill', parts: ['ты чита', {gap: 'ешь'}, '']},
      {kind: 'fill', parts: ['он терп', {gap: 'ит'}, '']},
      {kind: 'fill', parts: ['о постройк', {gap: 'е'}, '']},
      {kind: 'fill', parts: ['в санатори', {gap: 'и'}, '']},
      {kind: 'fill', parts: ['к дочер', {gap: 'и'}, '']},
      {kind: 'fill', parts: ['в тетрад', {gap: 'и'}, '']}
    ]
  }
]

// ───────────────────────── main ─────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}. Run seedUsers.ts first.`)

  const parent = await prisma.category.findUniqueOrThrow({where: {slug: 'orthography'}})

  const report: {
    categories: {slug: string; id: string; isNew: boolean}[]
    topics: {slug: string; postId?: string; shortTestId?: string; largeTestId?: string; cheatSheetUrl?: string; skipped: boolean}[]
    summaryPdfUrl?: string
  } = {categories: [], topics: []}

  // ── categories ──
  const categoryIds = new Map<string, string>()

  const spellingWords = await prisma.category.findUniqueOrThrow({where: {slug: 'spelling-words'}})
  const prefixesSuffixes = await prisma.category.findUniqueOrThrow({where: {slug: 'prefixes-suffixes'}})
  categoryIds.set('spelling-words', spellingWords.id)
  categoryIds.set('prefixes-suffixes', prefixesSuffixes.id)
  report.categories.push({slug: 'spelling-words', id: spellingWords.id, isNew: false})
  report.categories.push({slug: 'prefixes-suffixes', id: prefixesSuffixes.id, isNew: false})

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
    'Орфография — оглавление блока',
    TOPICS.map((t) => ({name: t.ruName, line: t.summaryLine}))
  )
  const summaryUrl = await uploadBuffer(summaryBuffer, 'russian-course-cheatsheets', 'pdf', teacher.id, 'application/pdf')
  report.summaryPdfUrl = summaryUrl
  console.log(`\n+ сводный PDF блока «Орфография»: ${summaryUrl}`)

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
