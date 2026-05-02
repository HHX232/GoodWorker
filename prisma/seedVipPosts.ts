import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

const TEACHER_ID = '1bd2a3c9-ad1a-41ab-89bd-023ad21ef16c'

const VIP_EXPIRES_AT = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 дней

let _idCounter = 0
function uid() {
  return `vip-seed-${Date.now()}-${++_idCounter}`
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

function headingBlock(text: string, level: 2 | 3 = 2) {
  return {
    id: uid(),
    type: 'TEXT',
    payload: {
      content: {
        type: 'doc',
        content: [{type: 'heading', attrs: {level}, content: [{text, type: 'text'}]}]
      }
    }
  }
}

function mediaBlock(url: string, caption?: string) {
  return {id: uid(), type: 'MEDIA', payload: {url, kind: 'image', caption: caption ?? null}}
}

function extractMediaUrls(blocks: {type: string; payload: Record<string, unknown>}[]): string[] {
  return blocks
    .filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string')
    .map((b) => b.payload.url as string)
}

async function getCategoryId(slug: string): Promise<string | null> {
  const cat = await prisma.category.findUnique({where: {slug}, select: {id: true}})
  return cat?.id ?? null
}

const VIP_POSTS = [
  {
    slug: 'javascript-basics',
    title: 'Как стать Senior-разработчиком: полный путеводитель',
    additionalTitle: 'Реальный путь роста от Junior до Senior за 2-3 года',
    viewCount: 4821,
    blocks: [
      mediaBlock(
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200',
        'Путь разработчика'
      ),

      headingBlock('Почему большинство джунов застревают на одном месте'),
      textBlock(
        'Типичная ошибка начинающего разработчика — думать, что для роста достаточно просто выполнять задачи. Код сдан, ревью прошло, задача закрыта. Но в какой момент из этого получается Senior? Спойлер: никогда, если не менять подход осознанно.'
      ),
      textBlock(
        'Senior — это не про знание большего количества фреймворков. Это про то, как ты думаешь о задачах. Про понимание системы в целом, умение задавать правильные вопросы и объяснять решения команде. Технические навыки — лишь один из трёх столпов.'
      ),

      headingBlock('Три столпа Senior-разработчика'),
      textBlock(
        '1. Технические навыки. Глубокое понимание платформы, паттернов проектирования, алгоритмов, сетевого стека, баз данных. Не поверхностное «слышал», а «могу объяснить и применить».'
      ),
      textBlock(
        '2. Системное мышление. Умение видеть компромиссы (trade-offs). Когда выбирать SQL, а когда NoSQL. Когда монолит лучше микросервисов. Любое решение имеет цену — Senior её знает заранее.'
      ),
      textBlock(
        '3. Soft skills. Менторство джунов, ведение технических дискуссий, написание документации, декомпозиция задач на планировании, умение сказать «нет» правильно и с аргументами.'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200',
        'Командная работа'
      ),

      headingBlock('Конкретный план на 24 месяца'),
      textBlock(
        'Месяцы 1–6: Углубляйся в core-технологии своего стека. Если фронтенд — это JavaScript Event Loop, браузерный rendering pipeline, Web APIs. Если бэкенд — TCP/IP, HTTP/2, транзакции в БД, индексы. Читай исходники фреймворков, которыми пользуешься каждый день.'
      ),
      textBlock(
        'Месяцы 7–12: Начни делать code review. Предлагай улучшения аргументированно. Пиши architecture decision records (ADR) для нетривиальных решений в проекте. Попробуй mentoring — объясни сложную тему джуну. Если не можешь объяснить просто — ты сам не понял до конца.'
      ),
      textBlock(
        'Месяцы 13–18: Возьми ownership над фичей или модулем целиком. От обсуждения с продуктом до деплоя и мониторинга. Участвуй в on-call ротации. Разбирай инциденты и пиши post-mortem. Опыт production — незаменим.'
      ),
      textBlock(
        'Месяцы 19–24: Инициируй технические улучшения. Рефакторинг легаси, переход на новый инструмент, внедрение типизации. Влияй на архитектурные решения. В этот момент большинство работодателей уже готовы дать тайтл Senior.'
      ),

      headingBlock('Ресурсы, которые реально работают'),
      textBlock(
        'Книги: «Чистый код» Роберта Мартина, «Проектирование систем» Алекса Сюй, «Паттерны проектирования» банды четырёх (GoF), «Site Reliability Engineering» от Google. Не читай всё подряд — читай медленно и применяй сразу.'
      ),
      textBlock(
        'Практика: LeetCode (Medium уровень), System Design Interview, участие в open-source проектах. Сделай pet-проект с нуля до production — с CI/CD, мониторингом, документацией. Это покажет реальные навыки на собеседовании.'
      ),
      textBlock(
        'Сообщество: найди senior-разработчика готового быть ментором. Один час разговора с правильным человеком заменяет месяц самостоятельного чтения. Не бойся задавать «глупые» вопросы — бойся не задавать их вовсе.'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200',
        'Обучение и рост'
      ),

      headingBlock('Главная ошибка при движении к Senior'),
      textBlock(
        'Фокус на количестве технологий вместо глубины. Знать 15 фреймворков поверхностно хуже, чем знать 2-3 досконально. Работодатели хотят человека, который может решить сложную проблему, а не перечислить список слов из резюме.'
      ),
      textBlock(
        'Рост — это нелинейный процесс. Будут периоды плато, когда кажется, что застрял. Это нормально. Плато означает, что ты накапливаешь знания перед следующим скачком. Продолжай работать системно — результат появится.'
      )
    ]
  },

  {
    slug: 'variables-types',
    title: 'TypeScript: продвинутые паттерны для реального кода',
    additionalTitle: 'Generic, Conditional Types, Mapped Types и Type Guards с живыми примерами',
    viewCount: 3567,
    blocks: [
      mediaBlock(
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200',
        'TypeScript код'
      ),

      headingBlock('Зачем нужны продвинутые типы'),
      textBlock(
        'Базовый TypeScript — это аннотации: string, number, boolean, interface. Этого хватает для 70% задач. Но когда начинаешь строить библиотеки, обобщённые компоненты или работать с динамическими данными — нужна настоящая система типов.'
      ),
      textBlock(
        'TypeScript — это полноценный язык типов с условными выражениями, рекурсией и даже арифметикой на уровне типов. После этого урока ты будешь видеть типы совершенно иначе.'
      ),

      headingBlock('Generic Types: параметрический полиморфизм'),
      textBlock(
        'Generic — это шаблон типа. Вместо того чтобы писать отдельную функцию для Array<string> и Array<number>, пишем одну: function first<T>(arr: T[]): T | undefined { return arr[0] }. Тип T подставляется при вызове.'
      ),
      textBlock(
        'Ограничения Generic через extends: function getLength<T extends { length: number }>(value: T): number { return value.length }. Это работает и для string, и для array, и для любого объекта с полем length. Компилятор это знает без runtime-проверок.'
      ),
      textBlock(
        'Паттерн Builder с Generic позволяет строить типобезопасный API: class QueryBuilder<T> { select<K extends keyof T>(fields: K[]): QueryBuilder<Pick<T, K>> {...} }. Каждый вызов метода уточняет тип результата.'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200',
        'Написание кода'
      ),

      headingBlock('Conditional Types: логика в системе типов'),
      textBlock(
        'Синтаксис: T extends U ? X : Y. Читается как «если T совместим с U, то X, иначе Y». Пример: type IsString<T> = T extends string ? true : false. IsString<"hello"> → true, IsString<42> → false.'
      ),
      textBlock(
        'Infer — ключевое слово для извлечения типов внутри conditional. type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never. Это и есть как встроенный ReturnType работает в TypeScript. Infer говорит: «поймай этот тип и дай ему имя R».'
      ),
      textBlock(
        'Distributive conditional types: когда T — union, TypeScript применяет conditional к каждому элементу по отдельности. type NonNullable<T> = T extends null | undefined ? never : T. Для T = string | null | undefined результат будет string.'
      ),

      headingBlock('Mapped Types: трансформация объектов'),
      textBlock(
        'Mapped type итерирует по ключам и трансформирует значения. type Readonly<T> = { readonly [K in keyof T]: T[K] }. type Partial<T> = { [K in keyof T]?: T[K] }. Именно так устроены встроенные utility types.'
      ),
      textBlock(
        'Ремапинг ключей через as: type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }. Для { name: string } получим { getName: () => string }. Template literal types в mapped — мощный инструмент для генерации API.'
      ),

      headingBlock('Type Guards: сужение типов'),
      textBlock(
        'Type guard — функция, которая не только проверяет тип в runtime, но и сообщает об этом TypeScript: function isString(value: unknown): value is string { return typeof value === "string" }. После вызова в блоке if компилятор знает тип точно.'
      ),
      textBlock(
        'Discriminated Unions + switch — самый читаемый паттерн для обработки вариантов: type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number }. В switch по kind TypeScript автоматически сужает тип в каждой ветке.'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200',
        'Типизация'
      ),

      headingBlock('Практический пример: типобезопасный fetch'),
      textBlock(
        'async function fetchData<T>(url: string): Promise<T> { const res = await fetch(url); if (!res.ok) throw new Error(res.statusText); return res.json() as Promise<T> }. Вызов: const user = await fetchData<User>("/api/user"). TypeScript знает тип user без явного приведения.'
      ),
      textBlock(
        'Следующий уровень — Zod или валидаторы схем: они проверяют данные в runtime и возвращают тип, выведенный из схемы. type User = z.infer<typeof UserSchema>. Это закрывает разрыв между статической типизацией и реальными данными из API.'
      ),
      textBlock(
        'TypeScript — это инвестиция. Поначалу кажется, что пишешь больше. Но через 6 месяцев работы с хорошо типизированной кодовой базой ты поймёшь: большинство багов пойманы до запуска, рефакторинг безопасен, автодополнение точное. Это меняет качество работы навсегда.'
      )
    ]
  },

  {
    slug: 'api-design',
    title: 'System Design: проектируем масштабируемые системы',
    additionalTitle: 'От монолита до микросервисов: архитектура, базы данных и балансировка нагрузки',
    viewCount: 5134,
    blocks: [
      mediaBlock(
        'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200',
        'Архитектура системы'
      ),

      headingBlock('Почему System Design — главный навык для Senior'),
      textBlock(
        'На собеседованиях в крупные компании System Design занимает отдельный круг. Но это не только про интервью. Умение проектировать системы определяет, сколько боли доставит рост продукта. Хорошая архитектура незаметна — плохая ощущается при каждой новой фиче.'
      ),
      textBlock(
        'Проектирование — это искусство компромиссов. Нет идеального решения, есть подходящее для конкретного контекста: объём данных, команда, бюджет, требования к надёжности. Понимание этих компромиссов — и есть System Design.'
      ),

      headingBlock('Фундамент: ключевые характеристики систем'),
      textBlock(
        'Масштабируемость (Scalability): способность системы обрабатывать растущую нагрузку. Вертикальное масштабирование (bigger machine) быстро, но дорого и имеет потолок. Горизонтальное (more machines) сложнее, но практически неограниченно.'
      ),
      textBlock(
        'Доступность (Availability): процент времени, когда система работает. 99.9% = 8.7 часов даунтайма в год. 99.99% = 52 минуты. Каждая девятка стоит значительно дороже предыдущей. Всегда уточняй: какой SLA нужен бизнесу?'
      ),
      textBlock(
        'Консистентность (Consistency) vs Доступность: теорема CAP говорит, что при сетевых разделах (Partition) система вынуждена выбирать. Банковское приложение выберет консистентность. Лента новостей выберет доступность. Разные задачи — разные приоритеты.'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200',
        'Диаграмма архитектуры'
      ),

      headingBlock('Базы данных: когда что выбирать'),
      textBlock(
        'SQL (PostgreSQL, MySQL): ACID-транзакции, сложные JOIN-запросы, чёткая схема. Идеально для финансов, e-commerce, пользовательских данных. Горизонтальное масштабирование требует шардинга — это сложно, но решаемо.'
      ),
      textBlock(
        'NoSQL Document (MongoDB): гибкая схема, горизонтальный sharding из коробки. Хорошо для каталогов товаров, CMS, данных с переменной структурой. Слабая сторона — транзакции между документами исторически были ограничены.'
      ),
      textBlock(
        'Redis: in-memory хранилище, операции за микросекунды. Используют для кэша, сессий, rate limiting, pub/sub, очередей (через Streams). Данные в RAM — при перезапуске теряются (если не настроен persistence).'
      ),
      textBlock(
        'Правило выбора БД: начни с PostgreSQL. Она покрывает 95% задач, имеет JSONB для гибких данных, полнотекстовый поиск, партиционирование. Специализированные БД добавляй тогда, когда PostgreSQL реально перестаёт справляться.'
      ),

      headingBlock('Кэширование: слои и стратегии'),
      textBlock(
        'CDN (Content Delivery Network): статика раздаётся с ближайшего к пользователю узла. Изображения, CSS, JS — всё это должно идти через CDN. Задержка падает с сотен миллисекунд до единиц.'
      ),
      textBlock(
        'Application-level cache (Redis/Memcached): кэшируем тяжёлые запросы к БД. Паттерн Cache-Aside: сначала проверяем кэш, при промахе читаем из БД и кладём в кэш. TTL (время жизни) подбирается под частоту изменений данных.'
      ),
      textBlock(
        'Инвалидация кэша — одна из двух сложных задач в Computer Science (вторая — именование). Стратегии: TTL (просто, но данные могут устареть), Write-Through (пишем в кэш при каждом обновлении БД), Event-based (инвалидируем по событию изменения).'
      ),

      mediaBlock(
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200',
        'Серверная инфраструктура'
      ),

      headingBlock('Балансировка нагрузки и микросервисы'),
      textBlock(
        'Load Balancer распределяет запросы между инстансами сервиса. Round-Robin — по очереди. Least Connections — на сервер с минимумом активных соединений. IP Hash — один пользователь всегда попадает на один сервер (нужно для stateful-сервисов).'
      ),
      textBlock(
        'Микросервисы решают проблему масштабирования команд. Каждый сервис — отдельная команда, отдельный деплой, отдельная БД. Но появляются новые проблемы: сетевые вызовы вместо in-process, распределённые транзакции, distributed tracing.'
      ),
      textBlock(
        'Message Queue (Kafka, RabbitMQ): асинхронная коммуникация между сервисами. Producer публикует событие, Consumer обрабатывает когда готов. Это развязывает сервисы и добавляет буфер при пиковых нагрузках. Паттерн Event Sourcing строится на этой идее.'
      ),

      headingBlock('Как подходить к System Design интервью'),
      textBlock(
        'Шаг 1 — Requirements (5 мин): задай вопросы. Сколько пользователей? Какая нагрузка (read-heavy или write-heavy)? Нужна ли глобальная доступность? Какой SLA? Интервьюер хочет видеть, что ты думаешь о контексте, а не стреляешь решениями наугад.'
      ),
      textBlock(
        'Шаг 2 — High-level design (10 мин): нарисуй общую схему — клиент, API Gateway, сервисы, БД, кэш. Без деталей. Убедись, что интервьюер согласен с направлением, прежде чем углубляться.'
      ),
      textBlock(
        'Шаг 3 — Deep dive (20 мин): выбери 2-3 компонента для детального обсуждения. Предложи интервьюеру — что важнее для него? Обсуди схему БД, стратегию кэширования, обработку отказов. Называй компромиссы явно.'
      ),
      textBlock(
        'Шаг 4 — Bottlenecks (5 мин): найди узкие места в своём дизайне сам. Где может упасть? Как масштабировать? Это показывает зрелость мышления. Senior не только строит — он предвидит, где сломается.'
      )
    ]
  }
]

async function main() {
  let created = 0

  for (const post of VIP_POSTS) {
    const categoryId = await getCategoryId(post.slug)
    const mediaUrls = extractMediaUrls(post.blocks)

    await prisma.post.create({
      data: {
        teacherId: TEACHER_ID,
        categoryId,
        title: post.title,
        additionalTitle: post.additionalTitle,
        visibility: 'PUBLIC',
        content: {blocks: post.blocks},
        mediaUrls,
        isVip: true,
        vipExpiresAt: VIP_EXPIRES_AT,
        aiTopics: [],
        viewCount: post.viewCount
      }
    })

    console.log(`+ [VIP] ${post.title}`)
    created++
  }

  console.log(`\nDone: ${created} VIP posts created, expires ${VIP_EXPIRES_AT.toLocaleDateString('ru-RU')}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
