/**
 * Создаёт пост "Редакторы кода" с текстом, фото и мини-тестом.
 * Запуск: DATABASE_URL="postgresql://nikitatisevic@localhost/goodworker" npx tsx prisma/seedCodeEditors.ts
 */
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

type Inline = string | { text: string; bold?: boolean; italic?: boolean; code?: boolean }

function h2(text: string) {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }
}
function h3(text: string) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] }
}
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
function b(text: string): Inline { return { text, bold: true } }
function i(text: string): Inline { return { text, italic: true } }
function c(text: string): Inline { return { text, code: true } }

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
function blockquote(...nodes: object[]) {
  return { type: 'blockquote', content: nodes }
}
function doc(...nodes: object[]) {
  return { type: 'doc', content: nodes }
}

function textBlock(tiptapDoc: object) {
  return { id: uuidv4(), type: 'TEXT', payload: { content: tiptapDoc } }
}
function mediaBlock(url: string, caption: string) {
  return { id: uuidv4(), type: 'MEDIA', payload: { url, kind: 'image', caption } }
}
function miniTestBlock(title: string, blocks: object[]) {
  return { id: uuidv4(), type: 'MINI_TEST', payload: { title, blocks } }
}

async function main() {
  const teacher = await prisma.teacher.findUnique({ where: { email: 'teacher@seed.dev' } })
  if (!teacher) throw new Error('Teacher not found — run seedUsers.ts first')

  const testBlocks = [
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Что означает аббревиатура IDE?',
        options: [
          { id: 'a', text: 'Integrated Development Environment' },
          { id: 'b', text: 'Internet Development Editor' },
          { id: 'c', text: 'Internal Debug Engine' },
          { id: 'd', text: 'Instant Deploy Extension' },
        ],
        correctId: 'a',
      },
    },
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'Какой редактор является кросс-платформенным и полностью бесплатным?',
        options: [
          { id: 'a', text: 'WebStorm' },
          { id: 'b', text: 'Visual Studio (Windows)' },
          { id: 'c', text: 'Visual Studio Code' },
          { id: 'd', text: 'Sublime Text' },
        ],
        correctId: 'c',
      },
    },
    {
      id: uuidv4(),
      type: 'CHOOSE_OPTION',
      payload: {
        question: 'В чём главное отличие IDE от «лёгкого» редактора?',
        options: [
          { id: 'a', text: 'IDE стоит дороже' },
          { id: 'b', text: 'IDE работает на уровне целого проекта, а не одного файла' },
          { id: 'c', text: 'Лёгкий редактор не поддерживает плагины' },
          { id: 'd', text: 'IDE поддерживает только один язык программирования' },
        ],
        correctId: 'b',
      },
    },
    {
      id: uuidv4(),
      type: 'MATCH_PAIRS',
      payload: {
        pairs: [
          { id: 'p1', left: 'Visual Studio Code', right: 'Кросс-платформенный, бесплатный' },
          { id: 'p2', left: 'WebStorm',           right: 'Бесплатный для некоммерческого использования' },
          { id: 'p3', left: 'Notepad++',          right: 'Только Windows, бесплатный' },
          { id: 'p4', left: 'Sublime Text',       right: 'Кроссплатформенный, условно-бесплатный' },
        ],
      },
    },
  ]

  const blocks = [
    textBlock(doc(
      h2('Два типа редакторов'),
      p(
        'Большую часть рабочего времени программисты проводят в ', b('редакторах кода'), '. ',
        'Существует два основных типа: ', b('IDE'), ' и ', b('«лёгкие» редакторы'), '. ',
        'Многие используют оба — каждый для своих задач.',
      ),
    )),

    mediaBlock(
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900',
      'Рабочее место разработчика с открытым редактором кода',
    ),

    textBlock(doc(
      h2('IDE — интегрированная среда разработки'),
      p(
        b('IDE'), ' (', i('Integrated Development Environment'), ') — это мощный редактор, ',
        'который работает на уровне ', b('целого проекта'), ', а не отдельного файла.',
      ),
      p('IDE умеет:'),
      ul([
        p('Загружать весь проект и ', b('анализировать его структуру'), '.'),
        p(b('Автодополнение'), ' по всему проекту, а не только по открытому файлу.'),
        p('Интеграция с ', b('системой контроля версий'), ' (git, SVN).'),
        p('Встроенные инструменты для ', b('тестирования'), ' и ', b('отладки'), '.'),
      ]),
      h3('Популярные IDE'),
      ul([
        p(b('Visual Studio Code'), ' — кросс-платформенная, ', i('бесплатная'), '.'),
        p(b('WebStorm'), ' — кросс-платформенная, бесплатная для некоммерческого использования.'),
        p(b('Visual Studio Community'), ' — только Windows, бесплатная, отлично подходит для ', c('.NET'), '.'),
      ]),
      blockquote(
        p(i('Многие IDE платные, но их цена незначительна по сравнению с зарплатой разработчика. Попробуйте несколько — и выберите свою.')),
      ),
    )),

    mediaBlock(
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900',
      'Visual Studio Code — самый популярный редактор среди разработчиков',
    ),

    textBlock(doc(
      h2('«Лёгкие» редакторы'),
      p(
        '«Лёгкие» редакторы ', b('быстрее запускаются'), ' и проще в использовании. ',
        'Главная сфера применения — быстро открыть и отредактировать ', b('один файл'), '.',
      ),
      p(
        'На практике граница между IDE и «лёгкими» редакторами ', i('размыта'), ': ',
        'через плагины они тоже умеют автодополнение и анализ синтаксиса.',
      ),
      ul([
        p(b('Sublime Text'), ' — кроссплатформенный, условно-бесплатный.'),
        p(b('Notepad++'), ' — только Windows, полностью бесплатный.'),
        p(b('Vim'), ' и ', b('Emacs'), ' — мощные инструменты со своим порогом входа, но с огромными возможностями.'),
      ]),
      h2('Как выбрать?'),
      p(
        'Выбор редактора — ', b('личное дело каждого'), '. ',
        'Он зависит от ваших проектов, привычек и предпочтений. ',
        i('Попробуйте несколько вариантов'), ' и остановитесь на том, что комфортнее.',
      ),
    )),

    miniTestBlock('Редакторы кода — проверь себя', testBlocks),
  ]

  const mediaUrls = blocks
    .filter((b) => b.type === 'MEDIA')
    .map((b) => (b.payload as { url: string }).url)

  const category = await prisma.category.findFirst({ where: { slug: 'dev-tools' } })

  const post = await prisma.post.create({
    data: {
      teacherId: teacher.id,
      categoryId: category?.id ?? null,
      title: 'Редакторы кода',
      content: { blocks },
      mediaUrls,
      visibility: 'PUBLIC',
      isVip: false,
      aiModerated: false,
      aiTopics: ['JavaScript', 'Инструменты разработчика', 'IDE'],
    },
  })

  console.log(`✅ Post: ${post.id} — ${post.title}`)
  console.log(`   Блоков: ${blocks.length} (2 фото, 3 текста, 1 мини-тест с ${testBlocks.length} вопросами)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
