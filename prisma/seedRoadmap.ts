/**
 * Создаёт курс "Python для начинающих" с разными блоками для красивой лесенки.
 * Запуск: npx tsx prisma/seedRoadmap.ts
 */
import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'

const prisma = new PrismaClient()
const TEACHER_EMAIL = 'teacher@seed.dev'

// ─── Node helpers ──────────────────────────────────────────

type NodePos = { x: number; y: number }

function entryNode(id: string, pos: NodePos, title: string, description: string) {
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'ENTRY_POINT',
      inputs: {},
      roadTitle: title,
      roadDescription: description,
    },
  }
}

function dividerNode(id: string, pos: NodePos, label: string) {
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'DIVIDER',
      inputs: { text: label },
    },
  }
}

function infoTextNode(id: string, pos: NodePos, html: string) {
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'INFO_TEXT',
      inputs: { INFO_TEXT: html },
    },
  }
}

function infoMediaNode(id: string, pos: NodePos, url: string, label: string) {
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'INFO_MEDIA',
      inputs: {},
      mediaSize: 'medium',
      mediaItems: [{ url, type: 'image', points: 1, label }],
    },
  }
}

function fileNode(id: string, pos: NodePos, files: { name: string; url: string; mimeType: string; size: number }[]) {
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'DOWNLOAD_FILE_LINK',
      inputs: {},
      uploadedFiles: files,
    },
  }
}

function activeTestNode(id: string, pos: NodePos, question: string, options: string[], correctIndex: number) {
  const opts = options.map((text, i) => ({ id: uuid(), text }))
  return {
    id,
    type: 'roadNode',
    position: pos,
    data: {
      type: 'ACTIVE_TEST',
      inputs: {},
      activeTests: [
        {
          id: uuid(),
          type: 'CHOOSE_OPTION',
          payload: {
            question,
            options: opts,
            correctId: opts[correctIndex].id,
          },
        },
      ],
    },
  }
}

function edge(source: string, target: string) {
  return { id: `e-${source}-${target}`, source, target }
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { email: TEACHER_EMAIL } })

  // Node IDs
  const nEntry  = uuid()
  const nDiv1   = uuid()
  const nTxt1   = uuid()
  const nTxt2   = uuid()
  const nDiv2   = uuid()
  const nTxt3   = uuid()
  const nMedia1 = uuid()
  const nFile1  = uuid()
  const nDiv3   = uuid()
  const nTest1  = uuid()
  const nTxt4   = uuid()

  // Layout: vertical chain with 280px between steps
  const X = 200
  const DY = 280
  let y = 0

  const nodes = [
    entryNode(nEntry, { x: X, y: (y = 0) }, 'Python для начинающих', 'Полный курс по Python с нуля — от переменных до первого проекта'),
    dividerNode(nDiv1,   { x: X, y: (y += DY) }, '1. Введение'),
    infoTextNode(nTxt1,  { x: X, y: (y += DY) },
      '<h3>Что такое Python?</h3><p>Python — высокоуровневый язык программирования с простым синтаксисом. Создан Гвидо ван Россумом в 1991 году.</p><ul><li>Лёгкий для изучения</li><li>Огромная стандартная библиотека</li><li>Используется в AI, веб-разработке, автоматизации</li></ul>'),
    infoTextNode(nTxt2,  { x: X, y: (y += DY) },
      '<h3>История языка</h3><p>Первая версия Python 0.9.0 вышла в феврале 1991 года. Сейчас актуальна версия 3.x.</p><blockquote>«Читаемость кода имеет значение» — дзен Python</blockquote>'),
    dividerNode(nDiv2,   { x: X, y: (y += DY) }, '2. Основы языка'),
    infoTextNode(nTxt3,  { x: X, y: (y += DY) },
      '<h3>Переменные и типы данных</h3><p>В Python не нужно объявлять тип переменной — он определяется автоматически.</p><pre><code>x = 10          # int\nname = "Иван"   # str\npi = 3.14       # float\nactive = True   # bool</code></pre>'),
    infoMediaNode(nMedia1, { x: X, y: (y += DY) },
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Python_logo_and_wordmark.svg/1280px-Python_logo_and_wordmark.svg.png',
      'Логотип Python'),
    fileNode(nFile1,   { x: X, y: (y += DY) }, [
      { name: 'python_cheatsheet.pdf',   url: 'https://example.com/python_cheatsheet.pdf',   mimeType: 'application/pdf', size: 245000 },
      { name: 'exercises_week1.zip',     url: 'https://example.com/exercises_week1.zip',     mimeType: 'application/zip', size: 80000  },
    ]),
    dividerNode(nDiv3,   { x: X, y: (y += DY) }, '3. Практика'),
    activeTestNode(nTest1, { x: X, y: (y += DY) },
      'Какой тип данных у переменной x = 3.14?',
      ['int', 'float', 'str', 'bool'],
      1),
    infoTextNode(nTxt4,  { x: X, y: (y += DY) },
      '<h3>Следующие шаги</h3><p>Поздравляем с завершением базового курса! Дальше изучайте:</p><ol><li>Условия и циклы</li><li>Функции и модули</li><li>ООП в Python</li></ol><p>Удачи в обучении! 🚀</p>'),
  ]

  const edges = [
    edge(nEntry,  nDiv1),
    edge(nDiv1,   nTxt1),
    edge(nTxt1,   nTxt2),
    edge(nTxt2,   nDiv2),
    edge(nDiv2,   nTxt3),
    edge(nTxt3,   nMedia1),
    edge(nMedia1, nFile1),
    edge(nFile1,  nDiv3),
    edge(nDiv3,   nTest1),
    edge(nTest1,  nTxt4),
  ]

  const roadmap = await prisma.roadmap.create({
    data: {
      teacherId: teacher.id,
      title: 'Python для начинающих',
      price: 0,
      content: { nodes, edges },
      previewImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/800px-Python-logo-notext.svg.png',
    },
  })

  console.log('✅ Roadmap created:', roadmap.id)
  console.log('   Title:', roadmap.title)
  console.log('   Nodes:', nodes.length, '  Edges:', edges.length)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
