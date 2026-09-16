# Интерфейсы

## Правила проекта (для каждого субагента)

- Next.js App Router, TypeScript, Prisma + Postgres. Стек уже настроен — не переустанавливать, не менять версии.
- Стили — SCSS-модули (`*.module.scss`), паттерн тёмной темы уже есть:
  `:global(html.theme-dark), :global(html.pomodoro-dark) { ... }` — переопределяй
  цвета там же, где определил светлые. Смотри `src/widgets/Calendar/Modals/PaymentReminderModal/`
  как свежий образец (модалка, вкладки, тёмная тема, i18n).
- i18n — `next-intl`, ключи в `messages/{en,hi,ru,zh}.json`. **Все 4 локали
  обязательны** для любого нового пользовательского текста — это жёсткое
  правило проекта (в этой сессии уже дважды ловили баг «сырой ключ вместо
  перевода» из-за пропущенной локали). Если для конкретной локали в похожем
  месте уже сложилась практика неполного покрытия (например `calendar.createModal`
  отсутствует целиком в hi/zh) — не обязательно чинить весь пробел, но новые
  ключи всё равно клади во все 4 файла.
- Prisma: миграции — `npx prisma migrate deploy` (после `set -a; source .env; set +a`
  в bash, `.env` не грузится автоматически из-за `prisma.config.ts`). После
  правки схемы — `npx prisma generate`. Локальная БД — Postgres на localhost,
  строка подключения уже в `.env`.
- Тестового раннера в проекте нет. Проверка — **реальные HTTP-запросы** через
  `curl` к поднятому `npm run dev` с реальной сессией (логин через
  `/api/auth/callback/credentials` с csrf-токеном, сид-аккаунты
  `teacher@seed.dev`/`student@seed.dev`, пароль `password123`, связаны через
  `TeacherStudent`). Так же проверялись все фичи в этой сессии ранее —
  смотри существующие API-роуты календаря/оплаты как образец стиля.
- Файлы — существующий `POST /api/upload` (`src/shared/lib/uploadFile.ts` →
  `fetch('/api/upload', {method:'POST', body: formData с полями file/folder})`),
  S3-бэкенд уже настроен, 50 МБ серверный потолок, denylist опасных расширений.
  **Не создавать новый аплоадер** — только новый `folder` (`chat`) и клиентские
  проверки/сжатие поверх него.
- `tg-bot/` — отдельный git-репозиторий (сабмодуль `goodworker-tg-bot`), свой
  `git add`/`commit`/`push` внутри `tg-bot/`, отдельно от основного репозитория.
  Использует `pg` напрямую (без Prisma) — та же база данных.
- **Не трогать:** `ForNewDesign/` (статические прототипы, не связаны с этой
  задачей), файлы `src/widgets/VideoRoom/CallWhiteboard/*` и
  `src/widgets/VideoRoom/CallWhiteboard/ThreeDZone*` (параллельно работает
  другой агент — не стейджить, не коммитить, по возможности не читать без
  необходимости).
- Коммит только своих файлов (`git add <конкретные файлы>`, никогда `-A`/`.`),
  затем `git push origin main`. Перед коммитом — `git status --short`, чтобы
  убедиться, что в стейдж не попало чужое.
- Недостающая зависимость/пакет — возвращаем `BLOCKED`, не ставим самовольно.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `chat/data` (`app/api/chat/*`) | таблицы `Conversation`/`ChatMessage`, права доступа | HTTP-контракт (conversations/messages/read/unread-count) | get-or-create диалога, подсчёт unread, проверку `TeacherStudent` |
| `ChatWidget` (страница `/chats` + список + диалог + композер) | весь UI чата, поллинг, локальное состояние отправки | `<ChatWidget initialOtherId?/>` | вёрстку пузырей/карточек событий, интервалы поллинга |
| `ChatEntryPoints` (кнопка в `StudentDetailModal`, бейдж в `DashboardStudentSidebar`, кнопка в `DashboardCenter`, иконка в `Header`) | только точки входа | ссылки на `/chats?with=…` / `/chats` | ничего — тонкие обвязки существующих компонентов |
| `event-cards` (вставка `ChatMessage` с `eventType` из точек создания событий) | формирование `eventPayload` по типу события | `postEventCard({teacherId, studentId, eventType, payload})` (главное приложение) / аналог raw-SQL в tg-bot | get-or-create диалога изнутри — вызывающий код передаёт только пару id |

## Контракт API `chat/data` (тикет T01) — заполняется по мере сборки

Реализовано в `app/api/chat/**`. Общая проверка доступа и билдер ответов —
`src/shared/lib/chat/access.ts` (`getChatSessionUser`, `hasTeacherStudentLink`,
`getOwnedConversation`, `buildConversationSummary`, `otherRole`, `MAX_ATTACHMENT_BYTES`).

Авторизация везде через `auth()` (NextAuth). Роль `ADMIN` в сессии
трактуется как `TEACHER` с тем же `id` (тот же паттерн, что уже в
`app/api/teacher/calendar` и `app/api/teacher/payment-reminder`: сид-аккаунт
`teacher@seed.dev` числится в `AdminEmail`, поэтому логинится с ролью
`ADMIN`, но действует как обычный репетитор своим же `id`). Нет сессии → 401
на каждом эндпоинте.

Тип `ConversationSummary` (используется и в списке, и в get-or-create):
```ts
{
  id: string
  otherId: string            // id второй стороны (студента — для учителя, учителя — для студента)
  otherName: string
  otherAvatarUrl: string | null
  createdAt: string          // ISO
  lastMessageAt: string      // ISO
  lastMessage: {
    text: string | null
    attachmentType: string | null
    eventType: string | null
    senderRole: "TEACHER" | "STUDENT"
    createdAt: string        // ISO
  } | null                   // null у только что созданного диалога
  unreadCount: number        // сколько сообщений от собеседника ещё не прочитаны мной
}
```

Тип `ChatMessage` (как возвращается в истории и при отправке):
```ts
{
  id: string
  conversationId: string
  senderRole: "TEACHER" | "STUDENT"
  text: string | null
  attachmentUrl: string | null
  attachmentType: string | null
  attachmentName: string | null
  attachmentSize: number | null
  eventType: string | null
  eventPayload: unknown | null   // Json
  isRead: boolean
  createdAt: string               // ISO
}
```

### `GET /api/chat/conversations`
Список диалогов текущего пользователя, отсортирован по `lastMessageAt` desc.
— 200 `{ conversations: ConversationSummary[] }`
— 401, если нет сессии.

### `POST /api/chat/conversations`
Body: `{ otherId: string }`. Get-or-create по паре `(teacherId, studentId)`
(текущий пользователь — одна из сторон, `otherId` — другая; какая есть
`teacherId`/`studentId` определяется ролью текущего пользователя). Идемпотентно:
повторный вызов с тем же `otherId` возвращает тот же диалог.
— 200 `{ conversation: ConversationSummary }` (`lastMessage: null`, `unreadCount: 0` у нового)
— 400 `{ error: "otherId required" }`, если `otherId` не строка/отсутствует
— 403 `{ error: "Forbidden" }`, если между текущим пользователем и `otherId` нет `TeacherStudent`
— 401, если нет сессии

### `GET /api/chat/conversations/[id]/messages?before=<messageId>&limit=30`
Курсорная пагинация назад по времени. `limit` — по умолчанию 30, максимум 100.
`before` — id сообщения-курсора (не timestamp); без него отдаёт самые
свежие `limit` сообщений. Ответ отсортирован по времени **по возрастанию**
(старые → новые, готово к рендеру сверху вниз).
— 200 `{ messages: ChatMessage[], hasMore: boolean, nextCursor: string | null }`
  (`nextCursor` — id самого старого сообщения в странице, передать его следующим
  `before`, чтобы получить более раннюю историю; `null`, если `hasMore: false`)
— 401, если нет сессии
— 404 `{ error: "Not found" }`, если такого диалога нет вовсе
— 403 `{ error: "Forbidden" }`, если диалог существует, но принадлежит не текущему пользователю

### `POST /api/chat/conversations/[id]/messages`
Body: `{ text?: string, attachmentUrl?: string, attachmentType?: string, attachmentName?: string, attachmentSize?: number }`.
Требуется хотя бы одно из `text` (после `trim()`, непустой) или `attachmentUrl`.
`senderRole` в создаваемом сообщении — роль текущего пользователя (ADMIN → TEACHER).
Обновляет `conversation.lastMessageAt`.
— 200 `{ message: ChatMessage }`
— 400 `{ error: "Message must have text or an attachment" }`, если нет ни text, ни attachmentUrl
— 400 `{ error: "Attachment exceeds 10MB limit" }`, если `attachmentSize > 10 * 1024 * 1024`
— 401 / 404 / 403 — как у `GET .../messages`

### `PATCH /api/chat/conversations/[id]/read`
Отмечает `isRead: true` у всех сообщений в диалоге от **собеседника** (свои
исходящие не трогает).
— 200 `{ ok: true, updatedCount: number }`
— 401 / 404 / 403 — как у `GET .../messages`

### `GET /api/chat/unread-count`
Суммарно по всем диалогам текущего пользователя — сколько сообщений от
собеседников ещё не прочитаны.
— 200 `{ count: number }`
— 401, если нет сессии

### Модель данных
`Conversation` (`@@unique([teacherId, studentId])`) и `ChatMessage` —
реализованы дословно по схеме из тикета `01-data-and-api.md` / спецификации
(`senderRole: Role`, `eventType`/`eventPayload` на сообщении, `isRead` per-message).
Обратные связи: `Teacher.conversationsAsTeacher`, `Student.conversationsAsStudent`.
Миграция: `prisma/migrations/20260915211725_add_chat_system/`.

### Проверено curl'ом (сид-аккаунты + сторонний)
`teacher@seed.dev`/`student@seed.dev` (связаны `TeacherStudent`) +
`teachervip@seed.dev` (не связан со студентом — роль стороннего): get-or-create
(и его идемпотентность в обе стороны), отправка текста в обе стороны, пустое
сообщение → 400, вложение >10MB → 400, `unread-count` меняется независимо по
каждой стороне и обнуляется после `PATCH .../read` только у того, кто его
вызвал, список диалогов отдаёт `lastMessage`/`unreadCount`, пагинация
`before`/`nextCursor` подтверждена (limit=1 → следующая страница отдаёт более
раннее сообщение), доступ стороннего аккаунта к чужому диалогу → 403 на
messages GET/POST и на read PATCH, отсутствие сессии → 401 на всех защищённых
эндпоинтах, обращение к несуществующему `conversationId` → 404.

## Контракт `ChatWidget` (тикеты T02–T05) — заполняется по мере сборки

*(субагенты допишут сюда экспортируемые компоненты/пропсы, которыми
пользуются точки входа T06)*

### Каркас страницы (тикет T02) — готово

Страница: `app/chats/page.tsx` (top-level роут `/chats`, вне `(forTeachers)`/`(forStudents)` —
по конвенции `app/call`/`app/game`, доступных обеим ролям одним и тем же
файлом). Server component: `auth()` → редирект на `/login`, если сессии нет;
роль не разруливается на уровне страницы — `GET /api/chat/conversations`
сам возвращает диалоги нужной стороны по роли из сессии (ADMIN трактуется
как TEACHER, как и везде в чате). Рендерит `<ChatShell />` без пропсов.

Компонент: `src/widgets/Chat/ChatShell/ChatShell.tsx` (клиентский, `'use client'`).
Сам фетчит `GET /api/chat/conversations` на маунте (`fetch` + `useEffect`,
без SWR — в проекте её нет), хранит `conversations`, `loading`, `loadError`,
`selectedId` (id выбранного диалога) в локальном состоянии. Считает `mobileView`
как `selectedConversation ? 'conversation' : 'list'` и прокидывает его в
`data-mobile-view` на корневом контейнере — вся адаптивная логика (какая
панель видна на &lt;768px) живёт в CSS по этому атрибуту, JS ничего не скрывает
напрямую.

```ts
export interface ChatShellProps {
  /**
   * Рендерит правую панель для выбранного диалога. Не передан (или вернул
   * falsy) → ChatShell сам показывает плейсхолдер "выбери диалог слева"
   * (диалог не выбран) либо мини-плейсхолдер с шапкой/именем собеседника
   * и кнопкой "назад" (диалог выбран, но слот ещё не занят — это состояние,
   * в котором ChatShell живёт в T02 сам по себе). Тикет 03 передаёт сюда
   * реальный компонент диалога.
   */
  renderConversation?: (slot: ChatConversationSlotProps) => React.ReactNode
}

export interface ChatConversationSlotProps {
  conversation: ConversationSummary   // из @/shared/types/Chat/chat.types — выбранный диалог целиком
  onBack: () => void                  // сбрасывает selectedId → на мобиле возвращает к списку; на десктопе можно не использовать (там обе колонки видны всегда)
}
```

Использование тикетом 03 (пример):
```tsx
<ChatShell
  renderConversation={({ conversation, onBack }) => (
    <ChatWidget conversation={conversation} onBack={onBack} />
  )}
/>
```

Важно про `onBack`: ChatShell не рендерит "назад" сам, когда слот занят —
это ответственность компонента, который тикет 03 передаёт в `renderConversation`
(нужно показать кнопку "назад" только на &lt;768px, см. `.backBtn` в
`ChatShell.module.scss` как образец — `display:none` по умолчанию,
`display:flex` в `@media (max-width: 768px)`).

`ChatShell` не читает query-параметры (`?with=…`) — глубокая ссылка из
`ChatEntryPoints` (T06) на конкретный диалог в T02 не реализована (не входило
в критерии приёмки тикета). Если T06 или другой тикет захочет это добавить,
самый чистый путь — новый опциональный проп у `ChatShellProps` (например
`initialOtherId?: string`), который после первой успешной загрузки списка
ищет диалог с этим `otherId` и, если не находит, дергает
`POST /api/chat/conversations` для get-or-create — контракт `ChatShell`
не заморожен настолько, чтобы это было ломающим изменением.

Тип данных: `src/shared/types/Chat/chat.types.ts` — клиентское зеркало
`ConversationSummary` из `src/shared/lib/chat/access.ts`, но с датами как
`string` (ISO), а не `Date` — ровно то, что реально приходит в браузер после
`fetch(...).then(r => r.json())`. Импортировать типы для клиентских
компонентов чата отсюда, не из `access.ts` (тот файл серверный — тянет
Prisma/`auth()`, и его `Date`-поля не совпадают с фактическим JSON).

Список диалогов: `src/widgets/Chat/ConversationList/ConversationList.tsx` +
`.module.scss`. Пропсы:
```ts
export interface ConversationListProps {
  conversations: ConversationSummary[]
  loading: boolean
  loadError?: boolean
  selectedConversationId: string | null
  onSelect: (conversation: ConversationSummary) => void
}
```
Мгновенный клиентский фильтр по `otherName` (case-insensitive `includes`),
без похода на сервер. Три текстовых состояния независимы: `t('loading')` —
идёт фетч; `t('loadError')` — фетч упал; `t('empty')` — `conversations.length === 0`
(диалогов нет вообще); `t('noResults')` — диалоги есть, но фильтр ничего не
нашёл. Превью последнего сообщения: `eventType` → `t('eventMessage')`,
иначе `text`, иначе `attachmentType` → `t('attachmentMessage')`, иначе (нет
`lastMessage`) → `t('noMessages')`. Аватар — `otherAvatarUrl` через
`next/image` с `unoptimized` (не полагаемся на `remotePatterns` в
`next.config` — домен S3/аватарок туда не заведён, а падать из-за этого
нельзя), иначе цветной кружок с инициалом через переиспользуемый
`getAvatarColor(name)` из `@/shared/ui/User/UserHeaderCard/UserHeaderCard`
(тот же хэш-по-имени, что уже красит аватары в остальном приложении).

Каркас/адаптив: `src/widgets/Chat/ChatShell/ChatShell.module.scss`. Контейнер
`.container` — `width/height: 100%; max-width: 2200px; max-height: 1400px`,
центрирован во `.page` (flex center, `background:#EEEFF8`, светлая тема),
рамка + `box-shadow`; на десктопе grid `minmax(280px, 360px) 1fr` (список
всегда рядом с диалогом). На `max-width: 768px` — grid схлопывается в одну
колонку, `[data-mobile-view='list']`/`[data-mobile-view='conversation']`
на `.container` показывают ровно одну из панелей на всю ширину/высоту
(не сжатые колонки — вторая панель `display:none`). Тёмная тема —
`:global(html.theme-dark), :global(html.pomodoro-dark)` в конце файла,
токены палитры взяты из `src/widgets/Dashboard/StudentTeachersSidebar/` и
`PaymentReminderModal` (акцент `#534AB7`/тёмный `#818cf8`, тёмный фон
карточек `#1a1c24`, тёмный фон страницы `#12141f`).

i18n: новый namespace `chat` в `messages/{en,hi,ru,zh}.json` (title,
searchPlaceholder, loading, loadError, empty, noResults, noMessages,
attachmentMessage, eventMessage, back, emptyPlaceholder, selectedPlaceholder)
+ `PageTitles.chats`. Тикет 03/04/05 добавляют свои ключи в тот же
namespace `chat` (composer, вложения, карточки событий и т.п.) — не создавать
отдельный namespace ради этого.

Проверено (curl + Puppeteer поверх `npm run dev`, сид-аккаунты
`teacher@seed.dev`/`student@seed.dev`/`teachervip@seed.dev`): без сессии
`/chats` → 307 на `/login`; обе роли получают реальный список (создан и
проверен диалог teacher↔student через `POST /api/chat/conversations` +
`POST .../messages`, виден `lastMessage`/`unreadCount` в UI обеих сторон);
`teachervip@seed.dev` (без `TeacherStudent`) видит `t('empty')`
("Диалогов пока нет"); поиск — мгновенный (без сетевых запросов), кириллица
регистронезависимо, несуществующее имя → `t('noResults')`; на десктопе
(1400px) обе панели видны одновременно, контейнер не превышает 2200×1400
даже на 2600×1600 (реально замерено — 2200×1400, отцентрирован); на 390px
выбор диалога скрывает список и показывает диалог на всю ширину, кнопка
"назад" возвращает к списку; 1440px и 360px — без горизонтального скролла
от компонентов чата (на 360px есть существующий не связанный с чатом
оффсет в 4px от `Header` при длинном имени пользователя — воспроизводится
и на других роутах без чата, вне зоны этого тикета); тёмная тема
(`html.theme-dark`) переключает фон/цвета контейнера и списка.

### ChatEntryPoints (тикет T06) — готово

Четыре точки входа, все тонкие обвязки существующих компонентов (см. таблицу
границ выше), без правки `ChatShell`/`ConversationList`/`app/chats/page.tsx`.

1. `StudentDetailModal.tsx` — кнопка `chat.goToChat` в `headerActions`, рядом
   с `offerBtn`. По клику сама вызывает `POST /api/chat/conversations
   {otherId: studentId}` (get-or-create), затем `router.push`.
2. `DashboardStudentSidebar.tsx` — бейдж `.unreadBadge` в правом верхнем углу
   `.card`, источник — `GET /api/chat/conversations`, отфильтрованный по
   `otherId === student.id`, поле `unreadCount`; поллинг раз в 15с, бейдж не
   рендерится при `unreadCount === 0` (или отсутствии диалога).
3. `DashboardCenter.tsx` — `Link` `chat.goToChats` → `/chats` сразу после
   `.statsMerged`, рендерится только при `isOwner`.
4. `Header.tsx` — новый компонент `ChatHeaderIcon`
   (`src/widgets/BaseUI/Header/ChatHeaderIcon.tsx` + `.module.scss`),
   вставлен в разметке сразу после `<NotificationBell />`. Паттерн 1:1 с
   `NotificationBell` (тот же `useSession` гейт, тот же `.btn`/`.badge`
   визуальный контракт), источник — `GET /api/chat/unread-count`, поллинг
   раз в 15с (у `NotificationBell` — раз в 60с, разная частота — по спеке
   этого тикета). Работает одинаково для `TEACHER`/`ADMIN` и `STUDENT`
   сессий — эндпоинт сам скопирован по роли.

Переход на конкретный диалог: `StudentDetailModal` после get-or-create ведёт
на `/chats?conversationId=<id>` — параметр пока ничего не делает, т.к.
`ChatShell` его не читает (см. выше, "не входило в критерии Т02"). Это
**предложение на будущее**, не реализация: страница `ChatShell` могла бы
принять проп вида `initialConversationId?: string` (или переиспользовать
предложенный в Т02 `initialOtherId?: string`) и после первой загрузки списка
искать/выбирать диалог с этим id — сама реализация вне зоны Т06.

Проверено curl'ом поверх `npm run dev` (сид-аккаунты
`teacher@seed.dev`/`student@seed.dev`): `POST /api/chat/conversations
{otherId}` из кнопки модалки идемпотентен (два вызова подряд — один и тот же
id); после отправки сообщения от `student@seed.dev` `GET
/api/chat/conversations`, отфильтрованный по `otherId`, и `GET
/api/chat/unread-count` для `teacher@seed.dev` синхронно показывают одно и
то же непрочитанное количество (оба источника — те же, что использует
бейдж сайдбара и иконка хедера); `PATCH .../read` обнуляет оба сразу; `GET
/api/chat/unread-count` для `student@seed.dev` после сообщения от учителя
тоже растёт — эндпоинт симметричен по роли. `/chats` в момент проверки
отдавал 500 (падает на `renderConversation`, передаваемом функцией из
серверного `app/chats/page.tsx` в клиентский `ChatShell` — незавершённая
параллельная работа тикета T03 над этим файлом, не в зоне T06), поэтому
клик по кнопке в `StudentDetailModal` проверен только на уровне
эндпоинта, которым он пользуется, а не сквозным рендером `/chats`.
Owner-гейт кнопки в `DashboardCenter` проверен и негативно: `<a
href="/chats">` есть в HTML `/teacher-profile` (владелец), но отсутствует
в HTML `/users/{teacherId}` под сессией стороннего `student@seed.dev`
(не-владелец) — единственное совпадение по тексту там было вхождение
JSON-словаря переводов, а не отрендеренный элемент.
