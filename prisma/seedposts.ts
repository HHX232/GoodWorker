import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

const TEACHER_ID = '1bd2a3c9-ad1a-41ab-89bd-023ad21ef16c'

const CATEGORY_IDS = [
  '03011f91-745d-41b7-8dfb-da0490c3fcf4',
  '0541c69b-e752-4966-b908-333a70df56c9',
  '06fb3e89-efab-433c-920a-14ea02171fa2',
  '64fe70d6-6dd6-474e-b56b-4c8eade68563',
  '67e18f80-9f84-46c6-9ec1-9c594e5d043a'
]

const IMAGES = [
  'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800',
  'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
  'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=800',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800',
  'https://images.unsplash.com/photo-1453733190371-0a9bedd82893?w=800',
  'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800'
]

let _idCounter = 0
function uid() {
  return `seed-${Date.now()}-${++_idCounter}`
}

function textBlock(text: string) {
  return {
    id: uid(),
    type: 'TEXT',
    payload: {
      content: {
        type: 'doc',
        content: [{type: 'paragraph', content: [{text, type: 'text'}]}]
      }
    }
  }
}

function mediaBlock(url: string) {
  return {id: uid(), type: 'MEDIA', payload: {url, kind: 'image', caption: null}}
}

function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]): string[] {
  return blocks
    .filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string')
    .map((b) => b.payload.url as string)
}

function makeContent(text: string, imageUrl?: string) {
  const blocks = imageUrl ? [textBlock(text), mediaBlock(imageUrl)] : [textBlock(text)]
  return {blocks, mediaUrls: extractMediaUrls(blocks)}
}

const POSTS: {title: string; categorySlug: string; text: string; image?: string}[] = [
  // Computer Science
  {
    title: 'Переменные и типы данных: с чего начать',
    categorySlug: 'variables-types',
    text: 'Переменная — это именованная ячейка памяти. В разных языках типы данных могут быть статическими или динамическими. Разберём основные: числа, строки, булевы значения и массивы.',
    image: IMAGES[0]
  },
  {
    title: 'Условия и циклы на практике',
    categorySlug: 'conditions-loops',
    text: 'if/else, switch, for, while — это фундамент любой программы. Рассмотрим каждую конструкцию с живыми примерами и разберём типичные ошибки новичков.',
    image: IMAGES[1]
  },
  {
    title: 'Функции: параметры и возвращаемые значения',
    categorySlug: 'parameters-returns',
    text: 'Функция принимает входные данные (параметры) и возвращает результат. Правильное именование и единственная ответственность — ключ к читаемому коду.',
    image: IMAGES[2]
  },
  {
    title: 'Рекурсия: когда функция вызывает саму себя',
    categorySlug: 'recursion',
    text: 'Рекурсия — это вызов функции из самой себя. Каждая рекурсия должна иметь базовый случай, иначе получится бесконечный цикл. Классический пример — факториал и числа Фибоначчи.',
    image: IMAGES[3]
  },
  {
    title: 'Алгоритмы сортировки: пузырёк, выборка, вставка',
    categorySlug: 'sorting-algorithms',
    text: 'Сортировка пузырьком имеет сложность O(n²), но проста в реализации. Quicksort в среднем работает за O(n log n). Выбор алгоритма зависит от объёма данных.',
    image: IMAGES[4]
  },
  {
    title: 'Бинарный поиск: эффективно и просто',
    categorySlug: 'searching-algorithms',
    text: 'Бинарный поиск работает только в отсортированном массиве. За каждую итерацию область поиска делится пополам — это даёт логарифмическую сложность O(log n).',
    image: IMAGES[5]
  },
  {
    title: 'Массивы vs Связные списки: что выбрать',
    categorySlug: 'arrays-lists',
    text: 'Массив даёт O(1) доступ по индексу, но вставка в середину стоит O(n). Связный список эффективен при вставке/удалении, но медленный при произвольном доступе.',
    image: IMAGES[6]
  },
  {
    title: 'Деревья: структура и обходы',
    categorySlug: 'trees-graphs',
    text: 'Двоичное дерево поиска позволяет искать элемент за O(log n) в сбалансированном случае. Обходы: pre-order, in-order, post-order — каждый имеет своё применение.',
    image: IMAGES[7]
  },
  {
    title: 'Основы SQL: SELECT, WHERE, JOIN',
    categorySlug: 'sql-basics',
    text: 'SQL — декларативный язык запросов. SELECT выбирает данные, WHERE фильтрует, JOIN объединяет таблицы. Один запрос с JOIN часто лучше нескольких запросов в цикле.',
    image: IMAGES[8]
  },
  {
    title: 'HTML и CSS: создаём первую страницу',
    categorySlug: 'html-css',
    text: 'HTML задаёт структуру, CSS — оформление. Начните с базовой разметки: html, head, body. Flexbox и Grid решают 90% задач по вёрстке.',
    image: IMAGES[9]
  },
  {
    title: 'Проектирование API: REST и ресурсы',
    categorySlug: 'api-design',
    text: 'Хороший REST API читается как предложение: GET /posts — получить список, POST /posts — создать. Используйте существительные во множественном числе для эндпоинтов.',
    image: IMAGES[10]
  },
  {
    title: 'Безопасность паролей: хэширование и соли',
    categorySlug: 'password-security',
    text: 'Никогда не храните пароли в открытом виде. Используйте bcrypt или argon2. Соль добавляется перед хэшированием, чтобы одинаковые пароли давали разные хэши.',
    image: IMAGES[11]
  },
  // Mathematics
  {
    title: 'Дроби: сложение, вычитание, умножение',
    categorySlug: 'fractions',
    text: 'Чтобы сложить дроби, нужно привести их к общему знаменателю. При умножении перемножаем числители и знаменатели. При делении переворачиваем вторую дробь и умножаем.',
    image: IMAGES[12]
  },
  {
    title: 'Проценты: задачи и формулы',
    categorySlug: 'percentages',
    text: 'Процент — это сотая часть числа. 1% от числа A = A/100. Для нахождения какого процента одно число составляет от другого: делим и умножаем на 100.',
    image: IMAGES[13]
  },
  {
    title: 'Линейные уравнения: методы решения',
    categorySlug: 'equations',
    text: 'Линейное уравнение вида ax + b = 0 имеет единственное решение x = -b/a (при a ≠ 0). Переносим слагаемые, упрощаем, находим x.',
    image: IMAGES[14]
  },
  {
    title: 'Неравенства и числовая прямая',
    categorySlug: 'inequalities',
    text: 'При умножении или делении неравенства на отрицательное число знак меняется на противоположный. Решение неравенства — это множество значений, а не одно число.',
    image: IMAGES[0]
  },
  {
    title: 'Теорема Пифагора и её применение',
    categorySlug: 'pythagorean-theorem',
    text: 'В прямоугольном треугольнике квадрат гипотенузы равен сумме квадратов катетов: c² = a² + b². Применяется для нахождения расстояний, проверки прямых углов.',
    image: IMAGES[1]
  },
  {
    title: 'Линейная функция: y = kx + b',
    categorySlug: 'linear-functions',
    text: 'Коэффициент k — угловой коэффициент (наклон графика), b — сдвиг по оси Y. При k > 0 функция возрастающая, при k < 0 — убывающая.',
    image: IMAGES[2]
  },
  {
    title: 'Квадратичная функция и парабола',
    categorySlug: 'quadratic-functions',
    text: 'График y = ax² + bx + c — парабола. Ветви вверх при a > 0, вниз при a < 0. Вершина находится по формуле x₀ = -b/(2a).',
    image: IMAGES[3]
  },
  // Russian
  {
    title: 'Гласные и согласные: правила произношения',
    categorySlug: 'vowels-consonants',
    text: 'В русском языке 6 гласных звуков и 36 согласных. Гласные образуют слог, согласные делятся на звонкие и глухие, твёрдые и мягкие. Пары: б-п, в-ф, г-к, д-т, ж-ш, з-с.',
    image: IMAGES[4]
  },
  {
    title: 'Ударение в русском языке',
    categorySlug: 'stress-rules',
    text: 'Русское ударение подвижное — оно может менять смысл слова (за́мок vs замо́к). Нет единого правила, нужно запоминать. Словарь ударений — лучший помощник.',
    image: IMAGES[5]
  },
  {
    title: 'Части речи: самостоятельные и служебные',
    categorySlug: 'parts-of-speech',
    text: 'Самостоятельные части речи: существительное, прилагательное, глагол, наречие, числительное, местоимение. Служебные: предлог, союз, частица. Каждая выполняет свою роль.',
    image: IMAGES[6]
  },
  {
    title: 'Запятые: 7 главных правил',
    categorySlug: 'commas',
    text: 'Запятая ставится при однородных членах, обращениях, вводных словах, перед союзами а/но/однако, в сложносочинённых и сложноподчинённых предложениях.',
    image: IMAGES[7]
  },
  {
    title: 'Тире: когда и зачем',
    categorySlug: 'dash',
    text: 'Тире ставится между подлежащим и сказуемым (оба — существительные), в неполных предложениях, перед обобщающим словом, при прямой речи.',
    image: IMAGES[8]
  },
  // English
  {
    title: 'Времена в английском: Present, Past, Future',
    categorySlug: 'tenses',
    text: 'В английском 12 времён, сгруппированных по видам: Simple, Continuous, Perfect, Perfect Continuous. Present Simple — регулярные действия, Present Continuous — действие прямо сейчас.',
    image: IMAGES[9]
  },
  {
    title: 'Артикли a, an, the: когда использовать',
    categorySlug: 'articles',
    text: 'A/An — неопределённый артикль (первое упоминание, один из многих). The — определённый (конкретный предмет, оба знают о чём речь). Без артикля: имена, страны, абстрактные понятия.',
    image: IMAGES[10]
  },
  {
    title: 'Фразовые глаголы: топ-20',
    categorySlug: 'phrasal-verbs',
    text: 'Фразовые глаголы = глагол + предлог/наречие. Их значение часто не совпадает с буквальным переводом. Give up (сдаться), look after (заботиться), run into (случайно встретить).',
    image: IMAGES[11]
  },
  {
    title: 'Модальные глаголы: can, must, should',
    categorySlug: 'ability-modals',
    text: 'Can — умение/возможность, must — строгая необходимость, should — совет. После модальных глаголов используем инфинитив без to: I can swim, you should rest.',
    image: IMAGES[12]
  },
  {
    title: 'Предлоги времени: in, on, at',
    categorySlug: 'time-prepositions',
    text: "Точное время — at (at 5 o'clock, at noon). День/дата — on (on Monday, on July 4th). Период — in (in the morning, in 2024, in summer).",
    image: IMAGES[13]
  },
  {
    title: 'Написание эссе на английском',
    categorySlug: 'essay-writing',
    text: 'Эссе состоит из введения, основной части и заключения. Введение формулирует тезис. Каждый абзац — одна мысль с доказательством. Заключение перефразирует тезис.',
    image: IMAGES[14]
  }
]

async function main() {
  let created = 0

  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i]
    const categoryId = CATEGORY_IDS[i % CATEGORY_IDS.length]
    const {blocks, mediaUrls} = makeContent(p.text, p.image)

    await prisma.post.create({
      data: {
        teacherId: TEACHER_ID,
        categoryId,
        title: p.title,
        visibility: 'PUBLIC',
        content: {blocks},
        mediaUrls,
        aiTopics: [],
        viewCount: Math.floor(Math.random() * 500)
      }
    })

    console.log(`+ ${p.title}`)
    created++
  }

  console.log(`\nDone: ${created} posts created`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
