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
