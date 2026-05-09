/**
 * Seed: 4 posts (2 public + 2 premium) for the seed teacher.
 * Run AFTER seedUsers.ts so the teacher exists.
 *
 *   npx tsx prisma/seedContent.ts
 */
import {PrismaClient} from '@prisma/client'
import {v4 as uuidv4} from 'uuid'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'

// ─── TipTap doc builders ─────────────────────────────────

function heading(text: string, level: 1 | 2 | 3) {
  return {type: 'heading', attrs: {level}, content: [{type: 'text', text}]}
}

function paragraph(text: string) {
  return {type: 'paragraph', content: [{type: 'text', text}]}
}

function bulletList(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{type: 'paragraph', content: [{type: 'text', text: item}]}],
    })),
  }
}

function codeBlock(code: string, language = '') {
  return {type: 'codeBlock', attrs: {language}, content: [{type: 'text', text: code}]}
}

function doc(...nodes: object[]) {
  return {type: 'doc', content: nodes}
}

// ─── Block helpers ────────────────────────────────────────

function textBlock(tiptapDoc: object) {
  return {id: uuidv4(), type: 'TEXT', payload: {content: tiptapDoc}}
}

function mediaBlock(url: string, caption?: string) {
  return {id: uuidv4(), type: 'MEDIA', payload: {url, kind: 'image', caption: caption ?? null}}
}

function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]) {
  return blocks
    .filter((b) => b.type === 'MEDIA' && typeof b.payload.url === 'string')
    .map((b) => b.payload.url as string)
}

// ─── Post definitions ─────────────────────────────────────

const IMAGES = {
  python1: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=900',
  python2: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=900',
  git1:    'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=900',
  git2:    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=900',
  sql1:    'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=900',
  sql2:    'https://images.unsplash.com/photo-1484557985045-edf25e08da73?w=900',
  algo1:   'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=900',
  algo2:   'https://images.unsplash.com/photo-1453733190371-0a9bedd82893?w=900',
}

function makePosts() {
  // ── POST 1: PUBLIC — Python для начинающих ────────────────
  const post1Blocks = [
    textBlock(doc(
      heading('Что такое Python и зачем его учить', 2),
      paragraph('Python — один из самых популярных языков программирования в мире. Его синтаксис намеренно прост и близок к обычному английскому, поэтому он идеально подходит как первый язык.'),
      paragraph('За последние 10 лет Python стал стандартом в трёх ключевых областях: веб-разработке (Django, FastAPI), анализе данных (Pandas, NumPy) и машинном обучении (TensorFlow, PyTorch).'),
    )),
    mediaBlock(IMAGES.python1, 'Рабочее место разработчика на Python'),
    textBlock(doc(
      heading('Установка и первый запуск', 2),
      paragraph('Скачайте Python 3.12+ с официального сайта python.org. После установки откройте терминал и проверьте версию:'),
      codeBlock('python --version\n# Python 3.12.3', 'bash'),
      heading('Переменные и базовые типы', 2),
      paragraph('В Python не нужно объявлять тип переменной — интерпретатор определяет его автоматически. Это называется динамической типизацией.'),
      codeBlock(
        'name = "Алиса"        # str\nage = 25               # int\nheight = 1.68          # float\nis_student = True      # bool\n\nprint(f"Привет, {name}! Тебе {age} лет.")',
        'python',
      ),
      heading('Управляющие конструкции', 2),
      paragraph('Условия и циклы — сердце любой программы. Python использует отступы вместо фигурных скобок:'),
      codeBlock(
        'for i in range(1, 6):\n    if i % 2 == 0:\n        print(f"{i} — чётное")\n    else:\n        print(f"{i} — нечётное")',
        'python',
      ),
    )),
    mediaBlock(IMAGES.python2, 'Пример Python-кода в редакторе'),
    textBlock(doc(
      heading('Что изучать дальше', 2),
      paragraph('После базового синтаксиса рекомендуется следующий путь:'),
      bulletList([
        'Функции и области видимости (def, lambda, closures)',
        'Объектно-ориентированное программирование (классы, наследование)',
        'Работа с файлами и исключениями',
        'Стандартная библиотека: os, pathlib, json, datetime',
        'Виртуальные окружения и pip',
      ]),
      paragraph('Практикуйтесь каждый день — даже 30 минут дают заметный прогресс уже через месяц.'),
    )),
  ]

  // ── POST 2: PUBLIC — Git: основы ─────────────────────────
  const post2Blocks = [
    textBlock(doc(
      heading('Git — система контроля версий', 2),
      paragraph('Git позволяет отслеживать изменения в коде, возвращаться к предыдущим версиям и работать в команде без конфликтов. Сегодня знание Git — обязательное требование для любого разработчика.'),
      heading('Установка и начальная настройка', 2),
      codeBlock(
        '# Установка (Ubuntu/Debian)\nsudo apt install git\n\n# Первичная конфигурация\ngit config --global user.name "Иван Петров"\ngit config --global user.email "ivan@example.com"',
        'bash',
      ),
    )),
    mediaBlock(IMAGES.git1, 'История коммитов в Git-репозитории'),
    textBlock(doc(
      heading('Основные команды', 2),
      paragraph('Рабочий цикл Git состоит из трёх зон: рабочая директория → индекс (staging) → репозиторий.'),
      codeBlock(
        'git init              # создать репозиторий\ngit add .             # добавить все файлы в индекс\ngit commit -m "feat: первый коммит"\ngit status            # проверить состояние\ngit log --oneline     # краткая история',
        'bash',
      ),
      heading('Ветки и слияния', 2),
      paragraph('Ветки позволяют разрабатывать фичи изолированно от основного кода. Это основа командной работы.'),
      codeBlock(
        'git branch feature/login   # создать ветку\ngit checkout feature/login  # переключиться\ngit merge feature/login     # слить в main\ngit branch -d feature/login # удалить ветку',
        'bash',
      ),
      heading('Типичные ошибки новичков', 2),
      bulletList([
        'Коммитить пароли и .env файлы — используйте .gitignore',
        'Огромные коммиты «сделал всё» — коммитьте маленькими атомарными шагами',
        'Работать прямо в ветке main — всегда создавайте feature-ветки',
        'Игнорировать конфликты слияния — разрешайте их сразу',
      ]),
    )),
    mediaBlock(IMAGES.git2, 'Схема работы с ветками'),
    textBlock(doc(
      heading('GitHub и удалённые репозитории', 2),
      paragraph('GitHub — облачный хостинг для Git-репозиториев. После создания репозитория на github.com подключите его к локальному:'),
      codeBlock(
        'git remote add origin https://github.com/user/repo.git\ngit push -u origin main',
        'bash',
      ),
    )),
  ]

  // ── POST 3: PREMIUM — SQL: от нуля до оконных функций ────
  const post3Blocks = [
    textBlock(doc(
      heading('SQL: полный разбор от SELECT до оконных функций', 1),
      paragraph('Этот материал — для тех, кто хочет перейти от базовых запросов к профессиональной работе с данными. Мы разберём структуру запросов, агрегацию, джойны и мощные оконные функции.'),
      heading('Структура SQL-запроса', 2),
      paragraph('SQL-запрос выполняется в следующем логическом порядке, который отличается от порядка написания:'),
      bulletList([
        '1. FROM / JOIN — определить источник данных',
        '2. WHERE — отфильтровать строки',
        '3. GROUP BY — сгруппировать',
        '4. HAVING — отфильтровать группы',
        '5. SELECT — выбрать столбцы',
        '6. ORDER BY — отсортировать',
        '7. LIMIT / OFFSET — ограничить выдачу',
      ]),
    )),
    mediaBlock(IMAGES.sql1, 'Визуализация JOIN-операций'),
    textBlock(doc(
      heading('Агрегатные функции', 2),
      codeBlock(
        'SELECT\n  department,\n  COUNT(*)          AS employee_count,\n  AVG(salary)       AS avg_salary,\n  MAX(salary)       AS max_salary\nFROM employees\nGROUP BY department\nHAVING AVG(salary) > 80000\nORDER BY avg_salary DESC;',
        'sql',
      ),
      heading('JOIN: виды и когда применять', 2),
      paragraph('Понимание джойнов — ключевой навык. Вот разбор трёх основных:'),
      codeBlock(
        '-- INNER JOIN: только совпадающие строки\nSELECT u.name, o.total\nFROM users u\nINNER JOIN orders o ON u.id = o.user_id;\n\n-- LEFT JOIN: все строки из левой таблицы\nSELECT u.name, o.total\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id;\n-- пользователи без заказов будут с NULL в o.total',
        'sql',
      ),
    )),
    mediaBlock(IMAGES.sql2, 'Пример оконных функций на практике'),
    textBlock(doc(
      heading('Оконные функции (Window Functions)', 2),
      paragraph('Оконные функции — самая мощная фича SQL для аналитики. Они вычисляют значения через набор строк, связанных с текущей, не сворачивая результат как GROUP BY.'),
      codeBlock(
        'SELECT\n  name,\n  department,\n  salary,\n  -- ранг внутри каждого отдела\n  RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank,\n  -- накопительная сумма зарплат\n  SUM(salary) OVER (PARTITION BY department ORDER BY salary) AS running_total,\n  -- зарплата предыдущего сотрудника\n  LAG(salary) OVER (PARTITION BY department ORDER BY salary) AS prev_salary\nFROM employees;',
        'sql',
      ),
      heading('Индексы и производительность', 2),
      paragraph('Без правильных индексов даже простой запрос на миллионе строк будет работать секунды. Правила:'),
      bulletList([
        'Создавайте индексы по столбцам в WHERE и JOIN условиях',
        'Используйте EXPLAIN ANALYZE для анализа плана запроса',
        'Составные индексы: порядок столбцов важен (selectivity первым)',
        'Избегайте функций в WHERE — они ломают использование индекса',
      ]),
    )),
  ]

  // ── POST 4: PREMIUM — Алгоритмы: сложность и сортировки ─
  const post4Blocks = [
    textBlock(doc(
      heading('Алгоритмы и структуры данных: то, что спрашивают на собеседованиях', 1),
      paragraph('Big O, сортировки, хеш-таблицы, деревья — без этого не обходится ни одно техническое собеседование в продуктовые компании. Разберём с примерами.'),
      heading('Нотация Big O', 2),
      paragraph('Big O описывает, как растёт время выполнения алгоритма при увеличении входных данных. Нас интересует худший случай.'),
      bulletList([
        'O(1) — константное время: доступ к элементу массива по индексу',
        'O(log n) — логарифмическое: бинарный поиск',
        'O(n) — линейное: обход массива',
        'O(n log n) — быстрая сортировка, merge sort',
        'O(n²) — пузырьковая сортировка, вложенные циклы',
      ]),
    )),
    mediaBlock(IMAGES.algo1, 'График роста сложности алгоритмов'),
    textBlock(doc(
      heading('Merge Sort — разбор по шагам', 2),
      paragraph('Merge Sort — алгоритм «разделяй и властвуй». Сложность O(n log n) в любом случае, что делает его надёжным выбором.'),
      codeBlock(
        'def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\ndef merge(left, right):\n    result = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            result.append(left[i]); i += 1\n        else:\n            result.append(right[j]); j += 1\n    return result + left[i:] + right[j:]',
        'python',
      ),
      heading('Хеш-таблицы', 2),
      paragraph('Хеш-таблица (dict в Python, Map в JS) даёт O(1) на вставку, удаление и поиск в среднем случае. Незаменима для задач на уникальность и подсчёт.'),
      codeBlock(
        '# Задача: найти два числа, сумма которых равна target\ndef two_sum(nums, target):\n    seen = {}  # значение -> индекс\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []\n\n# O(n) время, O(n) память — намного лучше O(n²) с двумя циклами',
        'python',
      ),
    )),
    mediaBlock(IMAGES.algo2, 'Визуализация бинарного дерева поиска'),
    textBlock(doc(
      heading('Бинарное дерево поиска (BST)', 2),
      paragraph('В BST для каждого узла: все левые потомки меньше, все правые — больше. Поиск, вставка, удаление — O(log n) при сбалансированном дереве.'),
      codeBlock(
        'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = self.right = None\n\ndef insert(root, val):\n    if not root:\n        return Node(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root\n\ndef inorder(root):\n    """Обход в порядке возрастания"""\n    if root:\n        yield from inorder(root.left)\n        yield root.val\n        yield from inorder(root.right)',
        'python',
      ),
      heading('Что готовить к собеседованию', 2),
      bulletList([
        'Массивы и строки: sliding window, two pointers',
        'Связные списки: разворот, нахождение цикла',
        'Деревья: DFS, BFS, LCA',
        'Динамическое программирование: fibonacci, knapsack, LCS',
        'Графы: DFS/BFS, Dijkstra для взвешенных',
      ]),
      paragraph('Рекомендую решать по 1–2 задачи в день на LeetCode, начиная с Easy, затем Medium.'),
    )),
  ]

  return [
    {
      title: 'Python для начинающих: от первой строки кода до циклов',
      isVip: false,
      visibility: 'PUBLIC' as const,
      blocks: post1Blocks,
      categorySlug: 'python-basics',
    },
    {
      title: 'Git за один день: коммиты, ветки и работа с GitHub',
      isVip: false,
      visibility: 'PUBLIC' as const,
      blocks: post2Blocks,
      categorySlug: 'git-basics',
    },
    {
      title: 'SQL Pro: агрегация, JOIN и оконные функции',
      isVip: true,
      visibility: 'PUBLIC' as const,
      blocks: post3Blocks,
      categorySlug: 'sql',
    },
    {
      title: 'Алгоритмы и структуры данных: полный разбор для собеседований',
      isVip: true,
      visibility: 'PUBLIC' as const,
      blocks: post4Blocks,
      categorySlug: 'algorithms',
    },
  ]
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) {
    console.error('❌ Teacher not found — run seedUsers.ts first')
    process.exit(1)
  }

  const posts = makePosts()

  for (const p of posts) {
    // Try to find category by slug, fall back to null
    const category = await prisma.category.findFirst({where: {slug: p.categorySlug}})

    const mediaUrls = extractMediaUrls(p.blocks as {type: string; payload: Record<string, unknown>}[])

    const created = await prisma.post.create({
      data: {
        teacherId: teacher.id,
        categoryId: category?.id ?? null,
        title: p.title,
        content: {blocks: p.blocks},
        mediaUrls,
        visibility: p.visibility,
        isVip: p.isVip,
        aiModerated: false,
        aiTopics: [],
      },
    })

    console.log(`✅ Post [${p.isVip ? 'PREMIUM' : 'PUBLIC '}]: ${created.id} — ${p.title}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
