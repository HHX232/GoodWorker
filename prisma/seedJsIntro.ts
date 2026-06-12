/**
 * Создаёт пост "Введение в JavaScript" с текстом, фото и мини-тестом.
 * Запуск: DATABASE_URL="postgresql://nikitatisevic@localhost/goodworker" npx tsx prisma/seedJsIntro.ts
 */
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

// ─── TipTap node helpers ──────────────────────────────────

function h2(text: string) {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }
}

function h3(text: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] }
}

// Параграф с поддержкой mixed-контента (строки и mark-объекты)
type Inline = string | { text: string; bold?: boolean; italic?: boolean; code?: boolean }
function p(...parts: Inline[]) {
  return {
    type: 'paragraph',
    content: parts.map((part) => {
      if (typeof part === 'string') return { type: 'text', text: part }
      const marks = []
      if (part.bold)   marks.push({ type: 'bold' })
      if (part.italic) marks.push({ type: 'italic' })
      if (part.code)   marks.push({ type: 'code' })
      return marks.length ? { type: 'text', text: part.text, marks } : { type: 'text', text: part.text }
    }),
  }
}

function b(text: string): Inline   { return { text, bold: true } }
function i(text: string): Inline   { return { text, italic: true } }
function c(text: string): Inline   { return { text, code: true } }

function ul(items: (string | object)[]) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [typeof item === 'string'
        ? { type: 'paragraph', content: [{ type: 'text', text: item }] }
        : item],
    })),
  }
}

function ol(items: string[]) {
  return {
    type: 'orderedList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  }
}

function blockquote(...nodes: object[]) {
  return { type: 'blockquote', content: nodes }
}

function doc(...nodes: object[]) {
  return { type: 'doc', content: nodes }
}

// ─── Post block helpers ───────────────────────────────────

function textBlock(tiptapDoc: object) {
  return { id: uuidv4(), type: 'TEXT', payload: { content: tiptapDoc } }
}

function mediaBlock(url: string, caption: string) {
  return { id: uuidv4(), type: 'MEDIA', payload: { url, kind: 'image', caption } }
}

function miniTestBlock(title: string, blocks: object[]) {
  return { id: uuidv4(), type: 'MINI_TEST', payload: { title, blocks } }
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({ where: { email: 'teacher@seed.dev' } })
  if (!teacher) throw new Error('Teacher not found — run seedUsers.ts first')

  const testBlocks = [
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Каким было первоначальное название JavaScript?',
        options: [
          { id: 'a', text: 'LiveScript' },
          { id: 'b', text: 'ActionScript' },
          { id: 'c', text: 'WebScript' },
          { id: 'd', text: 'NodeScript' },
        ],
        correctId: 'a',
      },
    },
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Какой движок JavaScript используется в Chrome и Edge?',
        options: [
          { id: 'a', text: 'SpiderMonkey' },
          { id: 'b', text: 'Chakra' },
          { id: 'c', text: 'V8' },
          { id: 'd', text: 'JavaScriptCore' },
        ],
        correctId: 'c',
      },
    },
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Что из перечисленного JavaScript НЕ может делать в браузере без разрешения пользователя?',
        options: [
          { id: 'a', text: 'Изменять HTML страницы' },
          { id: 'b', text: 'Читать произвольные файлы с жёсткого диска' },
          { id: 'c', text: 'Отправлять сетевые запросы' },
          { id: 'd', text: 'Работать с localStorage' },
        ],
        correctId: 'b',
      },
    },
    {
      id: uuidv4(),
      type: 'MATCH_PAIRS',
      payload: {
        pairs: [
          { id: 'p1', left: 'V8',             right: 'Chrome, Opera, Edge' },
          { id: 'p2', left: 'SpiderMonkey',   right: 'Firefox' },
          { id: 'p3', left: 'JavaScriptCore', right: 'Safari' },
          { id: 'p4', left: 'TypeScript',     right: 'Разработан Microsoft' },
        ],
      },
    },
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Какой язык добавляет строгую типизацию к JavaScript и разработан Microsoft?',
        options: [
          { id: 'a', text: 'CoffeeScript' },
          { id: 'b', text: 'Dart' },
          { id: 'c', text: 'Flow' },
          { id: 'd', text: 'TypeScript' },
        ],
        correctId: 'd',
      },
    },
  ]

  const blocks = [
    // Блок 1
    textBlock(doc(
      h2('Что такое JavaScript?'),
      p(
        'Изначально ', b('JavaScript'), ' был создан, чтобы ', i('«сделать веб-страницы живыми»'), '. ',
        'Программы на этом языке называются ', b('скриптами'), ' — они встраиваются в HTML и выполняются автоматически при загрузке страницы.',
      ),
      p(
        'Скрипты распространяются как простой текст и ', b('не требуют компиляции'), ' для запуска. ',
        'Это принципиально отличает JavaScript от ', b('Java'), '.',
      ),
      blockquote(
        p(b('Почему JavaScipt?'), ' Когда язык создавался, его звали ', i('«LiveScript»'), '. Но Java был невероятно популярен, и маркетинговое решение переименовать язык в «младшего брата» дало ему толчок. Сегодня JS — ', b('полностью независимый язык'), ' со спецификацией ', b('ECMAScript'), ' и никакого отношения к Java не имеет.'),
      ),
    )),

    mediaBlock(
      'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=900',
      'JavaScript — язык, работающий в каждом браузере',
    ),

    // Блок 2
    textBlock(doc(
      h2('Движки JavaScript'),
      p(
        'Сегодня JS выполняется не только в браузере, но и на сервере — через специальную программу, называемую ',
        b('движком'), ' (engine).',
      ),
      ul([
        p(c('V8'), ' — ', b('Chrome'), ', Opera, Edge'),
        p(c('SpiderMonkey'), ' — ', b('Firefox')),
        p(c('JavaScriptCore'), ' (Nitro) — ', b('Safari')),
        p(c('Chakra'), ' — Internet Explorer'),
      ]),
      h3('Как работает движок?'),
      ol([
        'Читает («парсит») текст скрипта.',
        'Компилирует в машинный код.',
        'Запускает и оптимизирует «на лету».',
      ]),
      p(
        'Движок применяет ', b('оптимизации на каждом этапе'), ', анализируя данные прямо во время выполнения. ',
        'Именно поэтому современный JS работает ', i('очень быстро'), '.',
      ),
    )),

    // Блок 3
    textBlock(doc(
      h2('Что может JavaScript в браузере?'),
      p('Вот что JS умеет прямо в браузере:'),
      ul([
        'Добавлять и изменять HTML/CSS «на лету».',
        'Реагировать на клики, нажатия клавиш, движения мыши.',
        'Отправлять сетевые запросы без перезагрузки страницы (AJAX, Fetch API).',
        'Читать и записывать куки, работать с localStorage.',
        'Показывать диалоги и уведомления.',
      ]),
      h2('Чего НЕ может JavaScript в браузере?'),
      p(
        'Возможности намеренно ограничены ради ', b('безопасности пользователя'), ':',
      ),
      ul([
        'Нет прямого доступа к файловой системе — только через явное действие пользователя.',
        'Разные вкладки изолированы друг от друга (Same Origin Policy).',
        'Доступ к камере и микрофону — только с явного разрешения.',
        'Запросы на чужие домены ограничены правилами CORS.',
      ]),
      blockquote(
        p(i('«Страница не может незаметно включить веб-камеру и отправить видео на сторонний сервер»'), ' — именно так работает модель безопасности браузера.'),
      ),
    )),

    mediaBlock(
      'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=900',
      'JS охватывает браузер, сервер и мобильные устройства',
    ),

    // Блок 4
    textBlock(doc(
      h2('Что делает JavaScript особенным?'),
      p('Три уникальных сильных стороны, которых нет у других браузерных технологий одновременно:'),
      ul([
        p(b('Полная интеграция'), ' с HTML и CSS.'),
        p(b('Простые вещи — просто'), ': для базовых задач не нужна сложная инфраструктура.'),
        p(b('Поддержка по умолчанию'), ' во всех основных браузерах.'),
      ]),
      h2('Языки «над» JavaScript'),
      p(
        'Синтаксис JS подходит не всем. Поэтому появились языки, которые ',
        b('транспилируются'), ' в JS перед запуском:',
      ),
      ul([
        p(b('TypeScript'), ' — строгая типизация, разработан Microsoft.'),
        p(b('CoffeeScript'), ' — короткий синтаксис, популярен у Ruby-разработчиков.'),
        p(b('Flow'), ' — типизация от Facebook.'),
        p(b('Dart'), ' — собственный движок от Google.'),
        p(b('Brython'), ' — транспилирует ', c('Python'), ' в JS.'),
      ]),
      p(
        i('Даже используя эти языки, нужно понимать JS'), ' — иначе невозможно разобраться, ',
        'что происходит «под капотом».',
      ),
      h2('Итого'),
      ul([
        'JavaScript создавался для браузера, но теперь работает везде.',
        'JS — единственная технология с полной интеграцией HTML/CSS, простотой и поддержкой всех браузеров.',
        'Транспилируемые языки стоит изучать после освоения самого JS.',
      ]),
    )),

    miniTestBlock('Введение в JavaScript — проверь себя', testBlocks),
  ]

  const mediaUrls = blocks
    .filter((b) => b.type === 'MEDIA')
    .map((b) => (b.payload as { url: string }).url)

  const category = await prisma.category.findFirst({ where: { slug: 'javascript-basics' } })

  const post = await prisma.post.create({
    data: {
      teacherId: teacher.id,
      categoryId: category?.id ?? null,
      title: 'Введение в JavaScript',
      content: { blocks },
      mediaUrls,
      visibility: 'PUBLIC',
      isVip: false,
      aiModerated: false,
      aiTopics: ['JavaScript', 'Веб-разработка', 'Основы программирования'],
    },
  })

  console.log(`✅ Post: ${post.id} — ${post.title}`)
  console.log(`   Блоков: ${blocks.length} (2 фото, 4 текста, 1 мини-тест с ${testBlocks.length} вопросами)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
