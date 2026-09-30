<!-- autopilot:start -->

# PDF → Тест — прототипы лендинга

> Раздел ведёт Autopilot между маркерами `autopilot:start` / `autopilot:end`.
> Текст вне маркеров не трогается.

## Что это

Набор из трёх статических прототипов рекламного лендинга продукта «PDF → Тест» (часть GoodWorker).
Один продукт, три принципиально разных визуальных мира; между ними переключаются одним кликом.
Живёт в `ForNewDesign/prototypes/` и полностью изолирован от Next.js-приложения GoodWorker.
Цель прогона — дизайн-разведка: выбрать сильнейшее направление, а не финальный продакшн.

## Стек

Статические HTML/CSS/JS. Без сборки, без npm, без фреймворков, без бэкенда, без тестов.
CSS и JS каждого варианта — инлайн в самом файле; общий только код в `shared/`.
Единственная внешняя зависимость — Google Fonts через `<link>` в `<head>`, всегда с web-safe fallback-стеком (работает офлайн).
Ничего больше не подключать: нет CDN-скриптов, нет сторонних JS-библиотек; вся анимация руками (CSS + vanilla JS).

## Команды

Запуск = открыть HTML в браузере по `file://` (двойной клик) или `open ForNewDesign/prototypes/index.html`.
Тестового раннера нет — верификация только визуальная/смоук (см. «Проверка» ниже).
Скриншот desktop — через headless-Chrome (ширина ≥500px, см. подводные камни).

## Структура

```
ForNewDesign/prototypes/
├── index.html                 витрина-сравнение: 3 карточки-ссылки на варианты
├── shared/
│   ├── switcher.js            переключатель вариантов + синк доли скролла
│   └── reveal-core.js         IntersectionObserver-ядро появления по скроллу
├── variant-a-swiss.html       V1 — Swiss / Kinetic Type
├── variant-b-terminal.html    V2 — Terminal / Blueprint
└── variant-c-cinematic.html   V3 — Cinematic / Gallery
```

Референсы вне прототипов: `PRODUCT.md` (правда о продукте), `ForNewDesign/DESIGN-SYSTEM.md` (крафт-ориентир),
`app/info-pdf-to-test/` (инкумбент-лендинг — только как визуальный референс мира V2, не трогать).
Крафт-планка задаётся скиллом `impeccable`.

## Ключевые файлы

`shared/switcher.js` — самоинициализируемый IIFE, vanilla, без зависимостей.
Ждёт `<nav data-switcher>` с `<a data-variant="a|b|c" href="variant-*.html">`; по имени текущего файла ставит `aria-current="page"` активной ссылке.
При клике пишет `sessionStorage['pdfland:scrollRatio'] = scrollY / (scrollHeight - innerHeight)` (доля 0..1).
На загрузке страницы восстанавливает позицию по доле: `history.scrollRestoration='manual'`, применение после двойного `requestAnimationFrame` (при reduced-motion — сразу).
Всё в `try/catch`: при недоступном `sessionStorage` просто не сохраняет/не восстанавливает.

`shared/reveal-core.js` — самоинициализируемый IIFE, vanilla, без зависимостей.
Находит все `[data-reveal]`, вешает IntersectionObserver с порогом `0.15`, при въезде ставит класс `.is-in` один раз и отписывается (`unobserve`).
При `prefers-reduced-motion: reduce` ИЛИ отсутствии IntersectionObserver — ставит `.is-in` всем сразу, observer не создаётся.
Ядро НЕ читает доп. data-атрибуты (`data-reveal="mask"`, `data-reveal-delay` и т.п.) — их трактует CSS/JS каждого мира.

`index.html` — Ч/Б витрина на Archivo; три карточки ведут в варианты; подключает оба shared-скрипта `defer`.

`variant-*.html` — каждый файл владеет своим миром целиком: свой CSS/JS инлайн, свои reveal- и hero-приёмы.
Каждый обязан подключить оба shared-скрипта `defer` и содержать `<nav data-switcher>` (см. контракт ниже).

## Архитектура

Три мира независимы по вёрстке, но делят ровно три общих контракта: переключатель, reveal-ядро и копирайт-дек.
Связь shared→мир односторонняя: shared-скрипты выставляют поведение и классы, а как это выглядит — решает CSS каждого варианта.

Контракт переключателя (СТРОГО одинаковая разметка во всех 4 файлах, стиль каждый мир задаёт свой):
```html
<nav data-switcher aria-label="Версии лендинга">
  <a data-variant="a" href="variant-a-swiss.html">V1</a>
  <a data-variant="b" href="variant-b-terminal.html">V2</a>
  <a data-variant="c" href="variant-c-cinematic.html">V3</a>
</nav>
```
Nav — fixed в углу экрана, компактный, не перекрывает hero-CTA; активность и синк скролла делает `switcher.js`.

Контракт reveal: мир помечает элементы `[data-reveal]` и в CSS описывает переход от базового состояния к `.is-in`.
Важно: базовое состояние должно оставлять контент видимым при reduced-motion (скрывать только через классы, которые `.is-in`/reduced-motion возвращают).

Три мира (принципиально разные — приоритет Ч/Б, много воздуха, один авторский hero-моушен на каждый):
- V1 Swiss (`variant-a-swiss.html`): Archivo; холодная белая палитра (`--bg:#fff; --ink:#0a0a0a`); строгая 12-колоночная сетка, hairline-линии, кинетическая типографика; hero — горизонтальный filmstrip со скрабом по скроллу.
- V2 Terminal (`variant-b-terminal.html`): JetBrains Mono; тёмная палитра (`--bg:#0d0d0f; --ink:#e6e6e3`); точечная сетка, скан-линия, один фосфорный сигнал `#d8ff3e` только на 1–2px; hero — «консоль обработки» с живым логом.
- V3 Cinematic (`variant-c-cinematic.html`): Bodoni Moda (Didone) + Archivo/Manrope; тёплая светлая галерея (`--bg:#f3f0ea; --ink:#0c0a08`); большие планы, максимум воздуха; hero — sticky-морфинг PDF→тест.

## V3-лаборатория — `v3-lab.html` (итерация 2)

`ForNewDesign/prototypes/v3-lab.html` — эволюция мира V3 (Cinematic) в один автономный файл с интерактивной панелью-лабораторией для подбора типографики, акцента и hero/шагов вживую. База — мир `variant-c-cinematic.html` (тёплая галерея: `--bg:#f3f0ea; --ink:#0c0a08`; Bodoni Moda + Archivo/Manrope; секции hero → Три шага → Шесть типов → Готовый тест → Профиль ошибок → Лимиты → FAQ → финал). Использует общий `shared/reveal-core.js`.

Токены на `:root` (всё через переменные, без хардкода): типографика `--fs-hero` (дефолт `3.4rem`, заметно меньше прежнего V3 до `6.4rem`), `--fs-h2`, `--fs-lead`, `--fs-body`, `--tracking-display` (em), `--leading` (unitless), `--section-rhythm`; акцент `--accent`/`--accent-soft`/`--accent-ink`; тёмная чертёжная подложка `--draft-bg` (`#12140f`).

Каркас переключения: `<html data-active-hero="1..4" data-active-steps="1..3">`; каждый hero — `<section data-hero="N">`, каждая вариация шагов — `<section data-steps="N">`; CSS показывает только активный (`html[data-active-hero="N"] [data-hero="N"]{display:block}`, прочие скрыты) — scroll-логика живёт только у активного.

Четыре hero: H1 Blueprint Exploded (изометрический разрез PDF→тест, слои разъезжаются по скроллу, список состава `01..04` подсвечивается) и H2 (фронтальный «разлёт» стопки) — оба на тёмной подложке `--draft-bg`, линии/выноски красятся `--accent-soft`; H3 — карточки-вопросы вылетают из бланка и встраиваются в блок ниже; H4 — уточнённый sticky-морф V3 с детальным бланком (дефолт). Три вариации «Три шага» (та же тройка Загрузка→Распознавание→Готовый тест): S1 вертикальные serif-ряды, S2 три колонки со связками, S3 иная раскладка/ритм.

Пять акцентных гамм (красят только акценты — линии/выноски/CTA/актив, блоки не заливают): `bordo`, `book` (дефолт), `teal`, `forest`, `terra`.

Панель `<aside class="lab">` (фиксированная, сворачиваемая): секции `Типографика` (ползунки → `--fs-*`/`--tracking-display`/`--leading`/`--section-rhythm`), `Гамма` (свотчи `[data-gamut]` → `--accent*`), `Hero` (4 кнопки → `data-active-hero`), `Три шага` (3 кнопки → `data-active-steps`), `Экспорт`/`Сбросить`. Persistence: `localStorage['pdfland:v3lab']` = JSON `{fs:{hero,h2,lead,body}, tracking, leading, rhythm, gamut, hero, steps}`, восстановление на загрузке (валидируется по типам; всё в try/catch — без localStorage панель работает). Экспорт собирает `:root{…}` из текущих токенов + строку «hero N · steps N · гамма id», кладёт в буфер через `navigator.clipboard.writeText` с fallback (textarea/prompt — на `file://` clipboard может быть закрыт). «Сбросить» возвращает `DEFAULTS`.

Копирайт-дельта: секция называется «Лимиты», три уровня Гость / Авторизованный / VIP (у VIP кнопка `Купить VIP`, цена-заглушка `[ЦЕНА VIP — впиши]`, `href="#"`). Остальной копирайт V3 — дословно из `variant-c-cinematic.html`.

## Кошелёк — wallet-*.html (дизайн-разведка)

Три статических прототипа страницы «Кошелёк» (не связаны с миром V1/V2/V3 выше — свой продукт-раздел, своя тройка файлов, своя разметка свитчера), тоже в `ForNewDesign/prototypes/`: `wallet-a-3d.html` (тёмный 3D-дашборд, `--bg:#12131a`), `wallet-b-mono.html` (Ч/Б-классика, `--bg:#f4f4f6`, единственный акцент `--accent:#534AB7`), `wallet-c-ledger.html` (тёплый «гроссбух», `--bg:#f6f1e7`, serif, акцент `--accent:#b5502e`). Использует общий `shared/reveal-core.js`; своего свитчер-скрипта в `shared/` нет — переключатель здесь инлайновый в каждом файле (см. ниже), не переиспользует `shared/switcher.js` из мира V1/V2/V3.

Общая композиция всех трёх: баланс (48 200 ₽) — крупнейший текст экрана, левый верхний угол; под ним три карточки-предложения (VIP / Pro-план / Личная услуга ученику); справа столбчатая диаграмма «Операции за неделю» (Пн–Вс, пик Сб) и под ней список из 5 операций (сумма со знаком + статус на каждой строке).

Контракт свитчера — СТРОГО одинаковая разметка во всех трёх файлах (стиль каждый мир задаёт свой):
```html
<nav data-wallet-switcher aria-label="Варианты кошелька">
  <a data-wallet="a" href="wallet-a-3d.html">3D</a>
  <a data-wallet="b" href="wallet-b-mono.html">Ч/Б</a>
  <a data-wallet="c" href="wallet-c-ledger.html">Гроссбух</a>
</nav>
```
Активная ссылка получает `aria-current="page"` через инлайн-скрипт по имени текущего файла (сравнение с `href`) — не через `shared/switcher.js` и без синка `pdfland:scrollRatio`.

Мок-данные (баланс, тексты трёх офферов, 7 значений диаграммы, 5 строк операций с датами «сегодня/вчера/N дней назад» строчными) зафиксированы дословно в `.autopilot/wallet-prototypes/interfaces.md` и обязаны быть идентичны байт-в-байт во всех трёх файлах — при постройке текст офферов VIP/«Личная услуга» разошёлся между файлами и это поймало только ревью задним числом. Кто бы ни правил мок-данные или копирайт офферов дальше: менять дословно во всех трёх `wallet-*.html` сразу, не точечно в одном.

## Соглашения

Язык копирайта — русский; канон текста — копирайт-дек в `.autopilot/pdf-test-landing/interfaces.md`, строки берутся дословно.
Иконки — рисованные inline-SVG в штрихе своего мира; НЕ эмодзи, НЕ юникод-глифы.
Ключ синка скролла — строго `pdfland:scrollRatio`; менять нельзя, иначе миры перестанут делить позицию.
CTA «Загрузить PDF» концептуально ведёт на `app/info-pdf-to-test`, но в прототипе — `href="#"` (placeholder).
Всё пишем только внутрь `ForNewDesign/prototypes/`; Next.js-приложение (`app/`, `src/`) не трогаем.
Недостающую зависимость не ставим — возвращаем `BLOCKED`.

## Проверка (смоук)

Страница открывается без ошибок в консоли; ссылки переключателя резолвятся; активная подсвечена.
При `prefers-reduced-motion: reduce` движение выключено, контент виден полностью.
Адаптив 360–1440px не ломается: нет горизонтального скролла `body` (у всех вариантов `overflow-x: hidden`).
Тяжёлые scroll-эффекты деградируют на мобильном (например, hero-скраб V1 активен только ≥900px).

## Подводные камни

Headless-Chrome не рендерит окно уже ~500px — снимай desktop-скриншоты при ширине ≥500px, иначе получишь пустоту/артефакты; мобильный проверяй в обычном браузере через DevTools.
Все 4 файла делят контракт переключателя и `pdfland:scrollRatio` — правка разметки nav или ключа в одном файле рассинхронизирует остальные.
Все варианты делят один копирайт-дек — текст меняется в деке (`interfaces.md`), затем во всех файлах, а не точечно.
`switcher.js`/`reveal-core.js` подключаются относительным путём `shared/...` — работает только при открытии из папки `prototypes/`.
В inline-SVG некоторые движки (Safari) не резолвят CSS-переменные в атрибутах — V3 использует литерал `#f3f0ea` вместо `var()`.
Восстановление скролла ждёт полный layout (шрифты/reveal меняют высоту): применяется после `load` + двойного rAF — мгновенного скачка при переключении не будет.
В `v3-lab.html` активные hero/steps ставит JS из `DEFAULTS` + `localStorage['pdfland:v3lab']` (дефолт `data-active-hero="4"`, `data-active-steps="1"`) — чтобы снять скриншот конкретного hero/шага, форсить `data-active-*` скриптом ПОСЛЕ `load` (иначе увидишь сохранённый/дефолтный вариант, а не нужный).
Blueprint-hero H1/H2 в `v3-lab.html` — на тёмной подложке `--draft-bg`: все линии/выноски/подписи красятся `--accent-soft` (тёмный `--accent` на тёмном фоне не читается) — новый акцент проверять и в этом контрасте.

## Как здесь работает Autopilot

Autopilot ведёт этот раздел между маркерами `autopilot:start`/`autopilot:end`; текст вне маркеров не трогает.
Прогон разбит на тикеты: 01 — фундамент (`index.html` + оба `shared/`-скрипта), 02/03/04 — варианты V1/V2/V3.
Единый источник правды исполнителей — `.autopilot/pdf-test-landing/interfaces.md` (контракты + копирайт-дек), читается ДО кода.
Верификация каждого тикета — смоук выше; юнит-тестов нет, прототип статичный.

<!-- autopilot:end -->

<!-- autopilot:chat-system:start -->

# GoodWorker — основное Next.js-приложение (репетитор↔ученик, чат)

Образовательная платформа, соединяющая репетиторов и учеников (профили, календарь, ДЗ, звонки, VIP-подписка, Telegram-бот); этот блок — про основное приложение и недавно добавленный чат репетитор-ученик, не про `ForNewDesign/` (см. блок выше — чужая, изолированная зона).

## Команды

`npm install` — установка (уже стоит, команда безопасна, no-op при чистом дереве).
`npm run dev` — старт на `:3000` (если порт занят, Next сам возьмёт следующий свободный — смотри лог, куда встал).
`npm run build` — `prisma generate && next build`. `npm run start` — прод-старт, сам гоняет `tsx prisma/seed-if-empty.ts` перед `next start`.
Миграции: `set -a; source .env; set +a && npx prisma migrate deploy` (`.env` не подхватывается автоматически — читает `prisma.config.ts`, а не dotenv). После правки `prisma/schema.prisma` — `npx prisma generate`.
Сиды: `npm run seed` (базовый), `npm run seed:all` (всё сразу). Сид-аккаунты для проверки: `teacher@seed.dev`/`student@seed.dev`/`teachervip@seed.dev`, у всех пароль `password123`; `teacher@seed.dev` и `student@seed.dev` связаны через `TeacherStudent`, `teachervip@seed.dev` — нет (полезен как «чужой» для проверки 403).
Тестового раннера в проекте фактически нет (`npm test`/`jest` формально есть в `package.json`, но чат и вся смежная функциональность проверялись не им) — верификация через `curl` к поднятому `npm run dev` с логином по сид-аккаунтам. Рабочий рецепт логина (проверено вживую в этой сессии):
```bash
CSRF=$(curl -s -c cookies.txt http://localhost:3000/api/auth/csrf | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -d "email=teacher@seed.dev&password=password123&csrfToken=$CSRF&json=true" -o /dev/null -w "%{http_code}\n"
curl -s -b cookies.txt http://localhost:3000/api/chat/conversations
```
`teacher@seed.dev` логинится с ролью `ADMIN` в сессии (числится в `AdminEmail`), не `TEACHER` — см. «Подводные камни».

## Структура (чат + где лежит остальное)

```
app/api/chat/
├── conversations/route.ts                 GET список / POST get-or-create
├── conversations/[id]/messages/route.ts   GET история (курсор) / POST отправка
└── conversations/[id]/read/route.ts       PATCH пометить прочитанным
app/chats/page.tsx              роут /chats (вне (forTeachers)/(forStudents), как app/call, app/game)
src/widgets/Chat/
├── ChatPage/ChatPage.tsx                  'use client' обёртка: читает ?conversationId=, композиция ChatShell+ConversationView
├── ChatShell/                             каркас страницы: список + слот диалога, адаптив по data-mobile-view
├── ConversationList/                      список диалогов + клиентский фильтр по имени
├── ConversationView/                      история сообщений, композер, поллинг, вложения/ГС (весь T04 тоже здесь — отдельного Composer/ не завели)
├── MessageBubble/                         пузырь: текст / вложение / EventCard-диспетчер
├── EventCard/                             карточки ДЗ/услуга/напоминание оплаты внутри пузыря
└── icons.tsx                              реэкспорт lucide-react под контекстными именами (Chat*Icon) — НЕ своя SVG
src/shared/lib/chat/access.ts     авторизация чата, билдеры ответов, postEventCard(), CHAT_EVENT_TYPES
src/shared/types/Chat/chat.types.ts   клиентские зеркала (ConversationSummary/ChatMessage) — импортировать отсюда в клиентских компонентах, не из access.ts (тот тянет Prisma/auth())
prisma/schema.prisma               модели Conversation/ChatMessage — миграция prisma/migrations/20260915211725_add_chat_system/
tg-bot/                            git-сабмодуль (goodworker-tg-bot), своя история коммитов, пишет в ту же БД напрямую через pg (не Prisma)
app/, src/                         остальное приложение: (forTeachers)/(forStudents) роуты, src/widgets по фиче, src/shared по слоям
```

## Ключевые файлы чата

`src/shared/lib/chat/access.ts` — `getChatSessionUser()` (ADMIN→TEACHER маппинг), `hasTeacherStudentLink`, `getOwnedConversation`, `buildConversationSummary`, `otherRole`, `MAX_ATTACHMENT_BYTES` (10 МБ), `CHAT_EVENT_TYPES`, `postEventCard({teacherId, studentId, eventType, payload})` — вызывать эту функцию для новой карточки события, не писать `ChatMessage` руками.
`src/widgets/Chat/ChatShell/ChatShell.tsx` — проп `initialConversationId?: string` (deep-link), `renderConversation?: (slot: {conversation, onBack}) => ReactNode`.
`src/widgets/Chat/ConversationView/ConversationView.tsx` — вся логика диалога: фетч истории, поллинг 3с, отправка, вложения (`compressImageForUpload` + `uploadFile(file,'chat')`), голосовые (`MediaRecorder`).
`src/widgets/Chat/EventCard/EventCard.tsx` — рендер по `message.eventType`: `HOMEWORK_ASSIGNED` / `PERSONAL_SERVICE` / `PAYMENT_REMINDER`, каждое поле `eventPayload` читается с фолбэком (Prisma `Json` нетипизирован).
Точки входа: `src/widgets/Dashboard/StudentDetailModal/StudentDetailModal.tsx` (кнопка «Перейти в чат», get-or-create + `router.push('/chats?conversationId=…')`), `src/widgets/Dashboard/DashboardStudentSidebar/DashboardStudentSidebar.tsx` (бейдж unread, поллинг 15с), `src/widgets/Dashboard/DashboardCenter/DashboardCenter.tsx` (ссылка «Перейти в чаты», только у владельца), `src/widgets/BaseUI/Header/ChatHeaderIcon.tsx` (иконка+бейдж рядом с `NotificationBell`, поллинг 15с).
Вызывающая сторона карточек событий: `app/api/homework/route.ts`, `app/api/services/route.ts` (оба через `postEventCard`, best-effort `.catch`, не блокируют основной ответ); `PAYMENT_REMINDER` создаётся из `tg-bot/src/db.ts` напрямую SQL-инсертом в `ChatMessage` (сабмодуль не может импортировать `postEventCard`).

## Архитектура чата

Реалтайма нет — поллинг: открытый диалог опрашивает `GET .../messages` раз в 3с (пропускается, если `document.visibilityState !== 'visible'`) + `PATCH .../read` best-effort; список диалогов и бейджи точек входа — раз в 15с через `GET /api/chat/unread-count` / `GET /api/chat/conversations`.
Модель: `Conversation` (`@@unique([teacherId, studentId])`, get-or-create в `POST /api/chat/conversations`) содержит `ChatMessage[]`; `isRead` — per-message, не per-conversation.
Unread считается как количество сообщений от **собеседника** с `isRead: false` в диалогах текущего пользователя; `PATCH .../read` помечает прочитанными только входящие (свои исходящие не трогает).
Карточки событий — обычный `ChatMessage` с непустыми `eventType`/`eventPayload`; `MessageBubble` диспетчерит `eventType → attachmentType → text`, добавление нового `eventType` не меняет `MessageBubbleProps`, только `EventCard` и `CHAT_EVENT_TYPES`.
Вложения идут через уже существующий общий аплоадер `POST /api/upload` (`src/shared/lib/uploadFile.ts`, S3-бэкенд) с `folder: 'chat'` — не создавать отдельный аплоадер под чат.

## Соглашения

Стили — SCSS-модули (`*.module.scss`), тёмная тема всегда в конце файла: `:global(html.theme-dark), :global(html.pomodoro-dark) { … }`, переопределяет только цвета, заданные для светлой темы выше.
i18n — `next-intl`, все пользовательские строки в `messages/{en,hi,ru,zh}.json`, чат живёт в общем namespace `chat` — новые ключи класть во все 4 файла одновременно, даже если для какой-то локали в похожем месте уже есть исторический пробел.
Иконки — только `lucide-react` (`src/widgets/Chat/icons.tsx` — реэкспорт под контекстными именами `Chat*Icon`), не рисовать свои inline-SVG для новых UI-элементов чата.
Роль в сессии: `session.user.role` может быть `ADMIN` для сид-аккаунта репетитора — везде, где различается TEACHER/STUDENT, трактовать `ADMIN` как `TEACHER` с тем же `id` (паттерн уже в `app/api/teacher/calendar`, `app/api/teacher/payment-reminder`, `src/shared/lib/chat/access.ts`).

## Окружение (только имена, без значений)

`DATABASE_URL` — Postgres, обязателен для Prisma/чата.
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` — сессии NextAuth (нужны для логина и всех защищённых `/api/chat/*`).
`S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `NEXT_PUBLIC_S3_PUBLIC_URL` — S3-совместимое хранилище (Selectel), нужны для загрузки вложений чата через `POST /api/upload`; `NEXT_PUBLIC_S3_PUBLIC_URL` обязателен отдельно — публичные ссылки идут не с API-эндпоинта, а с отдельного «Веб-сайт»-домена бакета (`src/shared/s3/s3Client.ts`, `publicUrlForKey`).

## Подводные камни

Server→Client: `app/chats/page.tsx` — серверный компонент, `ChatShell` — клиентский; нельзя передать замыкание (`renderConversation`) из первого напрямую во второй (React 500 «Functions cannot be passed directly to Client Components») — композиция `ChatShell` + `ConversationView` целиком вынесена в клиентский `src/widgets/Chat/ChatPage/ChatPage.tsx`, который и рендерит серверная страница.
`?conversationId=` — глубокая ссылка из точек входа (`StudentDetailModal` и т.п.) на конкретный диалог; читается в `ChatPage` через `useSearchParams()` внутри `<Suspense>` (обязательна граница над `useSearchParams()`), применяется в `ChatShell` один раз через `useRef`-guard, чтобы не перетирать последующий выбор пользователя; несуществующий/чужой id тихо остаётся на списке, без похода в `POST /api/chat/conversations` (диалог уже создан вызывающей стороной).
ADMIN→TEACHER: сид-репетитор логинится с ролью `ADMIN` (числится в `AdminEmail`), а не `TEACHER` — любой новый код, который различает роли по `session.user.role === 'TEACHER'` без учёта `ADMIN`, сломает чат для этого аккаунта; используй `getChatSessionUser()`/копируй его паттерн, а не сравнивай роль напрямую.
`tg-bot/` — отдельный git-репозиторий (сабмодуль, свой `git add`/`commit`/`push` внутри `tg-bot/`), пишет `ChatMessage` с `eventType: 'PAYMENT_REMINDER'` напрямую через `pg` raw SQL (`tg-bot/src/db.ts`) — у него нет доступа к Prisma-клиенту/`postEventCard()` основного приложения, схема дублируется вручную; при изменении модели `ChatMessage` в основном репо не забыть синхронизировать SQL в сабмодуле.
`npx prisma migrate deploy`/`generate` не видят `.env` без ручного `source` — `prisma.config.ts` управляет загрузкой конфигурации и не тянет dotenv сам.
`src/widgets/Chat/ConversationView/ConversationView.tsx` — вложения и голосовые (изначально планировались тикетом в отдельный `Composer/`) реализованы прямо здесь, отдельной директории `Composer/` в дереве нет.

## Как здесь работает Autopilot (чат)

Состояние прогона — `.autopilot/state.js`; контракты/копирайт для этой фичи и живая история тикетов — `.autopilot/chat-system/interfaces.md` (читать перед кодом), требования и их статус — `.autopilot/chat-system/manifest.md`, бриф — `.autopilot/chat-system/2026-09-15-brief.md`, тикеты — `.autopilot/chat-system/tickets/`.
<!-- autopilot:chat-system:end -->

<!-- autopilot:footer-variants:start -->

## Футер главной страницы — `src/widgets/Footer/` (продакшн)

По итогам витрины ниже выбран вариант «И1» (серые дрейфующие фигуры + блюр-панели) —
он выделен из гитигнорной песочницы в обычный, коммитящийся виджет и подключён
на `/` (`app/page.tsx`, рядом с `<LandingPage />`, только на главной странице,
не в корневом layout). Ключевые отличия production-копии от версии в песочнице:

- Реальные ссылки, а не `href="#"`: `/info-pdf-to-test`, `/vip`, `/teachers`,
  `/student-calendar`, `/calendar`, `/call`, `/terms`, `/privacy` (все — уже
  существующие роуты; `forStudents`/`forTeachers`/`videoCalls` ведут в личный
  кабинет и для незалогиненного посетителя уводят на `/login` — это ожидаемое
  поведение уже существующих страниц, не баг футера). Категорий две:
  «Продукт» и «Документы» — «Поддержка»/«Компания» из макета в продакшн не
  попали, для них нет реальных страниц (см. `.autopilot/footer-variants/interfaces.md`,
  если понадобится восстановить, что было в макете).
- Текст — через `next-intl`, namespace `Footer` в `messages/{en,hi,ru,zh}.json`
  (старый `Footer`-неймспейс был мёртвым шаблонным мусором от какого-то
  e-commerce-стартера — ни одного использования в коде; ключи полностью
  переписаны, а не дополнены).
- `useThreeLifecycle.ts`/`floatingShapes.ts` скопированы из
  `experiments/footer-variants/three-d/` и `.../iterations/shared/` (те
  версии гитигнорены — из production-кода на них нельзя ссылаться, копия
  обязательна, не импорт).
- Не обёрнут `next/dynamic({ssr:false})`, в отличие от версии в песочнице —
  JSX самого компонента не трогает `window`/`canvas` (это делает только
  `useEffect` внутри `useThreeLifecycle`), поэтому безопасно рендерится на
  сервере: ссылки в футере видны в HTML без JS, 3D — прогрессивное улучшение
  поверх них.

## Экспериментальная песочница — варианты футера (`experiments/footer-variants`)

Изолированная витрина из 12 готовых футеров GoodWorker (3 статичных + 3 с анимацией появления + 3 на raw `three` + 3 из второй волны по фидбеку на D1) для визуального выбора направления — сама витрина ни к одному реальному лендингу не подключена (победивший вариант выделен в отдельный продакшн-виджет, см. выше, а не импортируется отсюда). Соцсетей ни в одном варианте нет (у GoodWorker их нет).

Смотреть: `npm run dev`, затем `http://localhost:3000/experiments/footer-variants`.

Дерево:
```
app/experiments/footer-variants/page.tsx        серверный компонент маршрута, рендерит <Showcase />
src/experiments/footer-variants/
├── types.ts                                    export type FooterVariantEntry — форма записи всех трёх реестров
├── Showcase/Showcase.tsx (+.module.scss)        'use client', собирает 3 реестра в секции + якорный nav, не знает устройства футеров
├── static/index.ts                              export const staticVariants: FooterVariantEntry[] (s1–s3)
├── static/StaticMinimal/                        С1 — wordmark + одна строка ссылок
├── static/StaticMega/                           С2 — бренд-колонка + Продукт/Компания/Поддержка + копирайт-полоса
├── static/StaticInverted/                       С3 — тёмный блок, крупный CTA-заголовок
├── reveal/index.ts                              export const revealVariants: FooterVariantEntry[] (r1–r3)
├── reveal/RevealStagger/                        Р1 — колонки появляются по очереди (framer-motion stagger)
├── reveal/RevealAlternate/                      Р2 — колонки выезжают слева/справа поочерёдно
├── reveal/RevealMask/                            Р3 — заголовок проявляется clip-path-вайпом
├── three-d/index.ts                             export const threeDVariants: FooterVariantEntry[] (d1–d3), компоненты уже обёрнуты next/dynamic здесь
├── three-d/useThreeLifecycle.ts                 общий хук жизненного цикла THREE.WebGLRenderer/Scene/PerspectiveCamera для всех 3D-вариантов
├── three-d/DriftShapes/                         D1 — дрейфующие wireframe-фигуры фоном
├── three-d/TiltCard/                            D2 — 3D-карточка наклоняется за курсором
├── three-d/WaveSurface/                         D3 — полноширинная волновая поверхность
├── iterations/index.ts                          export const iterationVariants: FooterVariantEntry[] (i1–i3), 3D-варианты обёрнуты next/dynamic здесь же
├── iterations/shared/linkGroups.ts              общий набор ссылок по важности (Продукт/Поддержка/Компания/Документы), без соцсетей
├── iterations/shared/floatingShapes.ts          вынесенная механика дрейфа фигур (та же математика, что у DriftShapes) — переиспользуют И1/И2
├── iterations/FloatingLinks/                    И1 — серые фигуры на всю высоту футера, текст на блюр-панелях
├── iterations/FloatingColumns/                  И2 — колонны-плашки, фигуры дрейфуют в зазорах между ними
└── iterations/CleanLinks/                       И3 — без 3D: логотип + фраза + чистая сетка ссылок
```

Как устроено: `FooterVariantEntry = { id, label, description, Component }` (`Component` — без пропсов, рендерит готовый `<footer>`). Три реестра (`static/index.ts`, `reveal/index.ts`, `three-d/index.ts`) независимы друг от друга и каждый — единственная точка, которую трогает будущая правка: чтобы добавить/заменить/убрать вариант, редактируется только соответствующий `index.ts` (плюс папка самого компонента); `Showcase.tsx` импортирует все три массива, рендерит только непустые секции в фиксированном порядке (Статика → Появление → 3D) и строит якорную навигацию из `variant.id`/`variant.label` — сам `Showcase` не редактируется ради нового варианта.

Подводные камни:
- `.gitignore` (корень) содержит `/app/experiments/` и `/src/experiments/` — весь этот код невидим для git (`git status --porcelain` не показывает ни одного файла отсюда); коммитить в это дерево бессмысленно, пока эти две строки не убраны из `.gitignore`.
- 3D-компоненты (`DriftShapes`, `TiltCard`, `WaveSurface`) импортируются в `three-d/index.ts` через `next/dynamic(() => import(...), { ssr: false })` — они трогают `window`/`canvas`/`WebGLRenderer` напрямую и не могут рендериться на сервере; `Showcase` об этой обёртке не знает.
- `three-d/useThreeLifecycle.ts` — общий хук: создаёт рендерер/сцену/камеру один раз в `try/catch` (провал → `failed: true`, компонент сам рисует текстовую заглушку того же размера вместо канваса), держит `IntersectionObserver` (rAF на паузу вне вьюпорта, продолжение не с нуля при возврате), `matchMedia('(prefers-reduced-motion: reduce)')` с живым `change`-слушателем (при `reduce` — один статичный кадр, без цикла), `webglcontextlost` → `failed: true`, `ResizeObserver`, и на unmount чистит всё (`dispose()` геометрий/материалов через traverse, `renderer.dispose()`/`forceContextLoss()`). Новый 3D-вариант должен вызывать `useThreeLifecycle(containerRef, { init, animate, onResize, ...cameraOpts })` и отдавать в `init`/`animate` только логику своей сцены (пример использования — `three-d/DriftShapes/DriftShapes.tsx`), не писать цикл рендера заново.
- Автотестов нет и не планируется — чисто визуальный UI для сравнения, верификация только через `npm run dev` + браузер.
- Все ссылки внутри футеров — `href="#"`, копирайт-текст условный (категории ссылок, © GoodWorker) — макет для визуального сравнения, не рабочая навигация и не финальные тексты поддержки/юридических документов. Соцсетей нигде нет — их специально убрали из первой волны вариантов, узнав, что у GoodWorker их нет.
- Вторая волна (`iterations/`) использует более богатый набор ссылок (`shared/linkGroups.ts`, ~20 ссылок в 4 категориях по важности) — первая волна (`static/`, `reveal/`, `three-d/`) осталась на прежнем, более скромном наборе ссылок на колонку; если понадобится единообразие, придётся сознательно перенести `linkGroups` и туда.
- Глобальный сброс `src/shared/scss/main.scss` — `a { display: contents; ... }` — снимает у `<a>` собственный бокс на уровне всего приложения (не только этой песочницы). Любой список ссылок здесь (`.col a`, `.links a`, `.navLink` в `Showcase`) обязан сам вернуть `display` (`block` в flex-column, `inline-flex` в строке) — без этого ссылки колонки визуально сливаются в одну строку текста без пробелов между ними. Уже исправлено во всех 12 вариантах и в навигации витрины; тот же приём, что и в `src/widgets/Chat/EventCard/EventCard.module.scss` `.link` — если добавляешь новый вариант с ссылками, не забудь про это же свойство.
- Сборка (Lightning CSS в Turbopack, весь проект, не только эта песочница) молча удаляет из скомпилированного CSS **оба** объявления, если в одном правиле написать и `backdrop-filter`, и ручной `-webkit-backdrop-filter` с тем же значением — без ошибки сборки, эффект просто не работает. Писать только `backdrop-filter` без ручного webkit-дубликата (см. `iterations/FloatingLinks/FloatingLinks.module.scss` `.panel`, и рабочий пример без дубликата — `Showcase.module.scss` `.nav`).

## Как здесь работает Autopilot (варианты футера)

Состояние прогона — `.autopilot/state.js`; контракты — `.autopilot/footer-variants/interfaces.md` (читать перед кодом), требования и их статус — `.autopilot/footer-variants/manifest.md`, бриф — `.autopilot/footer-variants/2026-09-17-brief.md`. Тикетов четыре, ярус T1: 01 — каркас витрины и статика, 02 — появление, 03 — 3D, 04 — вторая волна по фидбеку на D1 (3 новых варианта + чистка соцсетей во всех предыдущих). Прогон не коммитится в git — вся песочница гитигнорена по прямому запросу заказчика.
<!-- autopilot:footer-variants:end -->

<!-- autopilot:wallet-balance:start -->

## Баланс/кошелёк вместо прямой покупки VIP — `src/shared/lib/wallet/`

7 платных AI-эндпоинтов раньше были заперты за `isVip`; теперь доступ решает баланс в центах
(mock-пополнение, без реального платёжного провайдера) — списывается реальная себестоимость
вызова DeepSeek + наценка, а VIP-статус (лимит участников звонка, VIP-посты, `/vip`-страница,
промокоды/рефералка) живёт отдельно и балансом не завязан: обнулённый баланс не трогает
`isVip`/`vipExpiresAt`.

### Ключевые файлы

`src/shared/lib/wallet/pricing.ts` — чистый движок цены, без Prisma и сайд-эффектов:
`isPeak(at: Date): boolean`, `computeCostCents(usage: AIUsage, at: Date): number`,
`estimateMaxCostCents(endpoint: string, promptChars: number, at: Date): number` (таблица
`OUTPUT_TOKEN_CEILING` по строковым ключам путей 7 эндпоинтов).
`src/shared/lib/wallet/wallet.ts` — весь доступ к балансу/леджеру: `getWalletSessionUser()`
(своя копия ADMIN→TEACHER, НЕ импортируется из `chat/access.ts` — кошелёк не зависит от чата),
`getBalanceCents(user)`, `preflightCheck(user, maxCostCents)` (кидает `InsufficientBalanceError`),
`chargeForAICall(user, endpoint, usage, at)`, `depositMock(user, amountCents)` (кидает
`InvalidDepositAmountError`), `listTransactions(user, cursor?, limit?)`,
`insufficientBalanceResponse(err)` — общий билдер 402-тела.
`app/api/wallet/{balance,topup,transactions}/route.ts` — HTTP кошелька.
`src/widgets/Wallet/{WalletBadge,WalletPage,InsufficientBalanceModal}/` — бейдж в
`Header.tsx`, страница `/wallet` (`app/wallet/page.tsx`), модалка нехватки средств
(`createPortal` в `#modal_portal`, тот же портал что `ModalWindowDefault`/`ModalImageZoom`).
`src/lib/openrouter.ts` — `callAI`/`callVisionAI` теперь возвращают `Promise<{content, usage}>`
(`AIResult`); тип `AIUsage` объявлен здесь, `pricing.ts` его импортирует (не наоборот).
`prisma/schema.prisma` — модель `WalletTransaction` (enum `WalletTransactionType:
DEPOSIT|AI_DEBIT`, отдельная от `VipTransaction` — та про VIP-дни, не про деньги), поле
`balanceCents` на `Teacher`/`Student`; миграция
`prisma/migrations/20260921195642_wallet_balance/`.
7 платных эндпоинтов: `app/api/whiteboard/formula-ai/route.ts`,
`app/api/whiteboard/formula-photo/route.ts`, `app/api/pdf-to-test/photos/route.ts`,
`app/api/pdf-to-test/route.ts`, `app/api/tests/import-pdf/route.ts`,
`app/api/teacher/lesson-plan/route.ts`, `app/api/teacher/lesson-plan/revise/route.ts`.
6 фронтенд-точек перехвата 402: `src/widgets/VideoRoom/CallWhiteboard/FormulaKeyboard.tsx`,
`.../FormulaPhotoModal.tsx`, `src/widgets/Calendar/Modals/LessonPlanModal/LessonPlanModal.tsx`,
`.../CalendarCreateModal/CalendarCreateModal.tsx`, `src/widgets/Tests/PdfImportModal/PdfImportModal.tsx`,
`app/info-pdf-to-test/page.tsx`.

### Архитектура

Поток на каждом платном эндпоинте: **preflight** (`preflightCheck` против
`estimateMaxCostCents`, ДО вызова AI-провайдера — заведомо неаффордный запрос не долетает до
DeepSeek) → `callAI`/`callVisionAI` → `parseJSON` ответа → **charge** (`chargeForAICall` с
реальным `usage` от провайдера) СТРОГО после успешного парсинга, не сразу после AI-вызова.
Себестоимость — из таблицы ставок DeepSeek `$/1M tokens` (non-peak/peak × hit/miss/out) в
`pricing.ts`, наценка сверху через `AI_MARKUP_PERCENT`; `isPeak(at)` — UTC 01:00–04:00 или
06:00–10:00, Пн–Пт (китайские праздники не учтены, известное ограничение).

Плательщик за `formula-ai`/`formula-photo` — владелец комнаты (`room.ownerId`/`ownerRole`
через локальный `roomOwnerWalletUser(room)`), не тот, кто нажал кнопку. Остальные 5 — текущий
`session.user` через `getWalletSessionUser()`. `lesson-plan`/`lesson-plan/revise` — ADMIN
по-прежнему бесплатен (preflight/charge пропускаются целиком), дословно как было при VIP-гейте.

`pdf-to-test`/`tests/import-pdf`: тариф на лимит страниц/формата (VIP 50 стр./любой формат,
не-VIP 5 стр./только PDF) НЕ меняется — списание накладывается поверх того, что тариф уже
разрешил обработать. Гостевой путь `pdf-to-test` (`isGuest`) вообще не обращается к `wallet`-модулю.

402-контракт (одинаков во всех 7 эндпоинтов): `{error: 'INSUFFICIENT_BALANCE', message,
neededCents, availableCents}`, HTTP 402, всегда до вызова AI. Собирается через
`insufficientBalanceResponse()` в `formula-ai`/`formula-photo`/`pdf-to-test/photos`/
`lesson-plan`/`lesson-plan/revise`; в `pdf-to-test` и `tests/import-pdf` тело собрано вручную
(вне зоны соответствующего тикета — сознательно не унифицировано, см. интерфейсы фичи).

### Соглашения

Единственное место, которое считает себестоимость — `pricing.ts`; никакой другой файл цену не
пересчитывает сам. Списание — строго после успешного `parseJSON`, не после голого `callAI`
(см. «Подводные камни» — это не всегда соблюдалось с первого раза). Строковые ключи эндпоинтов
в `estimateMaxCostCents`/`OUTPUT_TOKEN_CEILING` (`'whiteboard/formula-ai'` и т.п.) должны
буквально совпадать между `pricing.ts` и route-хендлерами. `VipTransaction` не переиспользуется
под деньги — леджер денег только `WalletTransaction`. `isVip`/`vipExpiresAt`-проверки вне этих
7 эндпоинтов эта фича не трогает.

### Окружение

`AI_MARKUP_PERCENT` — процент наценки сверх себестоимости DeepSeek (`pricing.ts`
`markupMultiplier()`); отсутствует или не число → `0%` (без наценки), не ошибка. Значение (даже
пустое) — в `.env.example`.

### Подводные камни

TOCTOU-гонка при обнулении баланса: первая версия `chargeForAICall` делала `getBalanceCents`
(отдельное чтение), затем безусловный `updateMany({balanceCents: 0})` — окно гонки, куда мог
влезть конкурентный `depositMock` и быть затёрт обнулением. Исправлено `zeroIfBelowCost` — один
атомарный SQL (`WITH locked AS (SELECT ... FOR UPDATE) UPDATE ... RETURNING`, через
`$queryRawUnsafe`), перепроверяющий `balanceCents < cost` в момент самой записи; вокруг
decrement+zeroIfBelowCost — ограниченный retry (`MAX_ATTEMPTS=5`), помечен `ponytail:`-
комментарием с путём апгрейда до `SERIALIZABLE`-транзакции.

Клиентские VIP-гейты, независимые от бэкенда: `FormulaKeyboard.tsx` и
`CalendarCreateModal.tsx` блокировали запрос ДО обращения к API по старому `isVip`, не зная,
что бэкенд-гейт уже снят — 2 из 7 эндпоинтов были физически недостижимы для не-VIP
пользователя с деньгами на балансе. Найдено и снято отдельно, позже основной замены гейтов —
при переносе/добавлении платных AI-фич искать такие гейты не только в `route.ts`.

«Списание только после успешного `parseJSON`» не сразу соблюдено везде: в первой версии
`formula-photo/route.ts` `chargeForAICall` стоял ДО `parseJSON`, так что невалидный JSON от
провайдера всё равно списал бы баланс; найдено ревью, перенесено после парсинга (тот же
порядок, что в остальных 4 эндпоинтах).

Смена сигнатуры `callAI`/`callVisionAI` на `{content, usage}` ломает компиляцию мест ВНЕ
периметра этой фичи: `src/lib/postAI.ts`, `src/shared/lib/gemini.ts`,
`app/api/calendar/google/import/route.ts`, `app/api/check-answer/route.ts`,
`app/api/tests/generate-title/route.ts`, `scripts/ingest-curriculum.ts` — адаптированы
отдельно (механическая правка вызова под новую сигнатуру, без биллинга этих мест).

Self-check скрипты — не тест-раннер, `npx tsx`, `pricing.selfcheck.ts` чистый (без БД):
```bash
npx tsx src/shared/lib/wallet/pricing.selfcheck.ts
```
`wallet.selfcheck.ts` реально бьёт по dev БД (создаёт и удаляет одноразовую `Teacher`-строку,
сид-аккаунты не трогает), нужен `DATABASE_URL`:
```bash
set -a; source .env; set +a && npx tsx src/shared/lib/wallet/wallet.selfcheck.ts
```
<!-- autopilot:wallet-balance:end -->

### Ежемесячная плата VIP (`settleMonthlyFee`)

Пока VIP активен, раз в 30 дней с баланса списывается `max(0, WalletSettings.monthlyFeeCents − потрачено на функции за период)`: дефолт $5, потратил $1.20 → $3.80, потратил $6 → $0. «Функции» — типы `AI_DEBIT`, `PINNED_LISTING_PURCHASE`, `STORAGE_OVERAGE_DEBIT` (`FEATURE_SPEND_TYPES` в `wallet.ts`); продвижение постов (`FEATURED_POSTS_PURCHASE`) сознательно НЕ засчитывается — оплачивается сверх платы; формула — `computeMonthlyFeeCents` в `pricing.ts`.
Период привязан к моменту получения VIP, не к календарю: `Teacher/Student.vipFeePeriodStart` ставят `depositMock` и активация промокода (`app/api/teacher/vip/activate`) при переходе не-VIP→VIP; VIP, выданный рефералкой/админом, получает якорь лениво (крон или первое открытие `/wallet`). Каждое закрытие периода сдвигает якорь на +30 дней; период, в конце которого VIP уже истёк, не биллится, и якорь обнуляется.
Нехватка баланса — берём сколько есть, остаток пишется в `shortfallCents` (в минус не уходим, долг не переносится). Строка леджера `MONTHLY_FEE` пишется только при списании > 0.
На `/wallet` — компактная полоса `MonthlyFeeCard` (одна строка правила + прогресс + сумма к списанию); полное объяснение с примерами — в модалке по ссылке «Подробнее о списаниях» (`ModalWindowDefault`).
Входы: крон `app/api/cron/wallet-monthly-fee/route.ts` (ежедневно, `vercel.json`, `Bearer CRON_SECRET`), `GET /api/wallet/monthly-fee` (снимок текущего периода для `MonthlyFeeCard` на `/wallet`), а также `depositMock` — он сначала закрывает просроченные периоды, чтобы не перезатереть якорь. Каждый период закрывается в своей транзакции с `SELECT … FOR UPDATE` строки пользователя: параллельный крон или открытие страницы не спишут дважды.
Миграция — `prisma/migrations/20260925120000_wallet_monthly_fee/`. Админ-UI для `monthlyFeeCents` пока нет: меняется только прямо в `WalletSettings`.

### Темы `/wallet`

Все виджеты `src/widgets/Wallet/*` красятся токенами `--w-*` с тёмным фолбэком в `var()`. Сами токены (светлые по умолчанию, тёмные под `html.theme-dark`/`pomodoro-dark`) объявлены на `html.wallet-page` в `WalletPage.module.scss`: класс вешает `WalletPage` на mount. На `/vip` класса нет, поэтому переиспользуемые там `PinnedListingSection`/`FeaturedPostsAddon` остаются тёмными. Новые цвета в wallet-виджетах — только через `--w-*`, не хардкодом.

### Бонусный баланс в промокодах

`PromoCode.bonusBalanceCents` («Бесплатный доп. баланс» в админке, только для типа `FREE_VIP`, 0–$1000): при активации в `app/api/teacher/vip/activate` баланс пополняется в той же транзакции, что и выдача VIP, и пишется строка леджера `PROMO_BONUS` (в истории — зелёная, как пополнение). Миграция `prisma/migrations/20260925150000_promo_bonus_balance/`.

### История и график на `/wallet`

`TransactionsTable` и `SpendChart` грузят данные сами (обновляются по `refreshKey`, который `WalletPage` бампает на любой `notifyWalletChanged`). Таблица — номерные страницы `GET /api/wallet/transactions?page=&pageSize=` (`listTransactionsPage`, offset; курсорный режим того же роута остался для других потребителей). График — расход на ИИ по дням, 14 дней на страницу, `GET /api/wallet/spend?from=&to=` отдаёт сырые строки `AI_DEBIT`, по локальным дням их раскладывает клиент (не сервер — иначе часовой пояс сервера). Дни с $0 рисуются заглушкой через `minPointSize`. Описания операций в БД хранятся по-русски; на остальных локалях таблица переводит их по `type`/`endpoint` (`wallet.history.desc.*`). Суммы-ценники красным не красим — только цвет основного текста, зелёный для пополнений.

### Чеки регулярных платежей на `/wallet`

`ReceiptsSection` — карточки-«чеки» под основным блоком: VIP (ежемесячная плата: база $5, серые строки трат на функции за период, «Зачтено из трат», «К списанию»), «Закрепление» и «Выделение постов» (срок действия + последние оплаты, «Оплачено»), «Хранилище» (занято из 7 ГБ, прогноз доплаты). Студент видит только VIP. Данные — `GET /api/wallet/receipts` → `getRecurringReceipts()` в `src/shared/lib/wallet/receipts.ts`; ключи строк переводятся на клиенте (`wallet.receipts.lines.*`). Срок в строке покупки парсится из описания леджера (`«на N мес.»`), отдельного поля months в `WalletTransaction` нет. Кнопки «Пополнить»/«Продлить» скроллят к якорям `#wallet-topup`/`#wallet-pinned`/`#wallet-featured` в `WalletPage`.

# GoodWorker — хранилище файлов репетитора (`tutor-files`)

Страница `/files` (VIP-репетитор и его ученики); ссылки — иконка в шапке, подменю профиля, ячейки «Хранилище» / «Файлы от репетиторов» в полосе статистики профиля. Эта сборка — **без Кошелька**: хранилище входит в VIP, квота (админка → Хранилище, по умолчанию 15 ГБ) — жёсткий потолок, загрузка сверх — 413 `QUOTA_EXCEEDED`. Контракты и история — `.autopilot/tutor-files/interfaces.md`, `.autopilot/tutor-files-reupload-edit/interfaces.md` (перезалив исправленного PDF).

- API `app/api/tutor-files/*`: `library` (read-модель для обеих ролей — браузинг идёт только через неё), `folders`, `files`, `grants`, `search`, `usage`, `limits`, `links`; админские — `app/api/admin/storage`, `app/api/admin/tutor-files/*` (тихий просмотр, ничего не пишет в `TutorFileOpen`/`TutorFolderOpen`).
- `src/shared/lib/tutorFiles/billing.ts` — единственная точка связи с Кошельком; здесь `STORAGE_BILLING_ENABLED = false`, `getStoragePricing() → null`. Wallet-сборка меняет только этот файл (+ крон и поле цены в админке).
- Видимость ученику — только через `loadStudentVisibility()`/`canStudentSee()` (`src/shared/lib/tutorFiles/access.ts`), с учётом окна доступа `activeGrantWhere()`; `restrictedToStudentId` бывает только у листовых личных подпапок.
- Prisma-клиент (`src/shared/prisma/prisma.ts`) по умолчанию omit-ит `TutorFile.contentText` (текст для поиска внутри файлов) — выбирать явно; тип строк — `TutorFileRow`.
- Клиент импортирует типы из `src/shared/types/TutorFiles/tutorFiles.types.ts` и константы из `src/shared/lib/tutorFiles/constants.ts` — не `access.ts`/`storage.ts` (тянут Prisma).
- `/content`-роуты всегда отдают `application/octet-stream` + `attachment` + `CSP: sandbox` (загруженный учеником .html не должен исполниться на нашем домене).
- `ReviewModal` (проверка работы репетитором): кнопка «Загрузить в директорию» впечатывает мазки пера **этой сессии** прямо в страницы PDF через `pdf-lib` (`import('pdf-lib')`, лениво) и грузит результат в ту же папку через уже существующий `FilesShell.uploadFiles()` (возвращает `Promise<LibraryFile[] | null>` — созданные строки или `null` при неудаче, а не просто `void`). Пометки из *прошлой* сессии проверки (`review.annotations`, уже загруженные PNG-слои) туда не впечатываются — риск тайнта `<canvas>` без гарантии CORS у S3-бакета. Гочта: `pagesRef.current?.hasChanges()` нельзя читать прямо в JSX рендера (`react-hooks/refs` фейлит билд) — держать как стейт, обновляемый в `onChange`.
- **Редактор docx** (`src/widgets/Files/DocxEditorModal/`) — пункт «Редактировать» у файлов `.docx` (только репетитор): `@docx-editor.dev/react`+`core` (Apache-2.0, полностью клиентский, не document-сервер), смонтирован через `next/dynamic(..., {ssr:false})`, чтобы ~7 МБ движка не попадали в основной бандл. `TutorFile.derivedFromId String?` (плоский маркер, не Prisma-relation) — правило сохранения: первое сохранение сессии создаёт новый файл `<имя> (исправлено).docx` рядом с оригиналом (`POST /files` с доп. полем `derivedFromId` в FormData), второе и следующие сохранения **той же сессии** перезаписывают именно его через новый `PATCH /api/tutor-files/files/[id]/content` (тот же контракт квоты/VIP-ошибок, что и POST; отказывает `400 NOT_DERIVED`, если `derivedFromId` пуст — оригинал так перезаписать нельзя). Не умеет xlsx/pptx (только `.docx`); UI редактора — на английском (`@docx-editor.dev/i18n` не поставляет `ru`).
- Локальная dev-БД этого чекаута **разошлась** с `prisma/migrations/`: часть таблиц tutor-files (`StorageSettings`, `TutorFileReview`, `TutorFileOpen`, `TutorFolderOpen`, `TutorFolderLink`, и колонка `TutorFolder.submissionDeadline`) физически отсутствуют локально (общая Postgres когда-то делилась с веткой кошелька, там применялся более ранний, несквошенный набор миграций). `prisma migrate dev`/`db push` в этом состоянии предлагают **удалить** реальные таблицы/данные Кошелька — ни то, ни другое нельзя запускать не глядя. Новое поле вносить точечно: hand-written `migration.sql` + `prisma db execute --file ...` + `prisma migrate resolve --applied <name>`, никогда `db push --accept-data-loss` или `migrate reset` в этом окружении.
- **Дедлайны сдачи файлов в календаре** (`app/api/tutor-files/deadlines`, `.../deadlines/mine`): у репетитора и ученика в `/calendar` и `/student-calendar` дедлайны `TutorFolder.submissionDeadline` показываются отдельным пунктом на день (как `Homework.dueAt`, тот же паттерн — teacher-only `GET .../deadlines`, student-only `GET .../deadlines/mine`, оба фетчатся клиентом в `CalendarPage.tsx`/`StudentCalendarPage.tsx` и передаются в `MonthCalendar` новым пропом `fileDeadlines` + `onDeadlineClick`). Только в месячном виде — `WeekCalendar`/`DayCalendar` не получают `homeworks` вообще, дедлайны туда тоже не добавлялись (не расширять асимметрию, которой не было). У репетитора клик по чипу открывает `SubmissionStatusModal` (`src/widgets/Calendar/Modals/`) — кто из учеников уже сдал/просрочил/не сдал, с датой; у ученика клик — сразу переход в `/files?folder=<id>`. Оба эндпоинта считают «сдал» по наличию `TutorFile.uploadedByRole==='STUDENT'` в личной подпапке ученика под папкой-дедлайном, «опоздал» — по сравнению даты первой сдачи с `submissionDeadline`.

# GoodWorker — конспект лекций (`/lecture`) и «Мои файлы» ученика

Живой конспект лекции для VIP-ученика, VIP-репетитора и админа (без лимитов): телефон пишет аудио кусками → свой STT → DeepSeek собирает конспект в TipTap-редакторе с формулами (mathlive), заметками, «Спросить ИИ», правкой по фото доски → экспорт в .docx/PDF/аудио и в хранилище.

- **Все ИИ-запросы — только DeepSeek** (`src/lib/openrouter.ts`: текст `deepseek-chat`, фото — vision-модель), фолбэка на OpenRouter нет; `callAI(..., { json: false })` — markdown-ответ, `onUsage` — токены для тарифа. `src/shared/lib/gemini.ts` — историческое имя, внутри тоже DeepSeek.
- **STT** — отдельный сервис `stt-server/` (FastAPI + faster-whisper, не путать с `stt-agent/` для LiveKit-звонков). Гибрид: черновик `small` по кускам во время записи, после «Стоп» — финал `large-v3-turbo`, `/concat` склеивает куски в .m4a. На Railway — сервис `lecture-stt`; приложению нужны `LECTURE_STT_URL` (приватная сеть: `http://lecture-stt.railway.internal:8080`) и `STT_API_KEY` (тот же, что у сервиса).
- **Аудио**: переключатель «Сохранять аудио» → S3 (считается в квоту владельца, `lectureAudioBytes` входит в `getUsedBytes`/`getStudentUsedBytes`); выключен → `LectureChunk.audioData` в БД только до финального прохода, потом обнуляется. Клиент всегда сначала кладёт кусок в IndexedDB (`recorder/chunkQueue.ts`) и удаляет после 200 от сервера. «Сохранить в файлы» при включённом «Сохранять аудио» кладёт рядом с .docx ещё и `<имя>.m4a` (`src/shared/lib/lecture/audioFile.ts`, в `after()`, тег тот же `lectureNoteId` — отличается по `mimeType audio/*`, поэтому флажок «Конспект»/переход в редактор ставится только НЕ-аудио файлам); у лекции с таким файлом аудио-куски больше не считаются в квоту (`lectureStorageBytes`), чтобы не платить дважды.
- **Формат ответа ИИ**: markdown-диалект (`$…$`, `$$…$$`, `==…==`, `=={green}…==`, `{red|…}`), разбирается на сервере в TipTap JSON по белому списку (`src/shared/lib/lecture/markdownToDoc.ts`) — HTML от модели в редактор не попадает. Секции ИИ — узел `aiSection` с `edited`: после правки студентом ИИ его больше не переписывает (финальное уточнение пропускает).
- **.docx** строится на сервере (`src/shared/lib/lecture/docx.ts`): формулы LaTeX → MathML (mathlive/ssr) → OMML (`mathml2omml`, LGPL — поэтому только сервер, не бандл), заметки → комментарии Word. Сохранённый файл помечен `lectureNoteId` (`StudentFile`/`TutorFile`) — открытие из `/files` ведёт обратно в `/lecture/[id]`.
- **Тариф** — `LectureSettings` (админка → Хранилище): первые N минут по базовой цене за 5 мин, дальше доплата за 5 мин + стоимость DeepSeek × наценка. `LECTURE_BILLING_ENABLED = false` (нет Кошелька) — считается, не списывается; `maxMinutesPerDay` — предохранитель.
- **«Мои файлы» ученика** — отдельные `StudentFolder`/`StudentFile` (не `TutorFile`: все проверки доступа библиотеки завязаны на `teacherId`), квота `StorageSettings.studentQuotaGb`, API `app/api/student-files/*`, вкладка в сайдбаре `/files` (`?tab=mine`). Домашка в папке репетитора по-прежнему в квоте репетитора.
- **Фото в конспекте** — `LecturePhoto` (приватный S3, отдаётся только через `GET /api/lecture/[id]/photos/[photoId]`, в квоте владельца), узел `lecturePhoto` с панелью «Обрезать лист» (тот же детектор листа `autoCropPagePhoto`, что в `/files`) и «В текст». Меню выделения → «Вставить с фото» (фото и/или распознанное содержимое после блока); левая колонка → «Обработать фото доски»: DeepSeek vision получает конспект пронумерованными блоками (`blockAnchors`) и помечает каждый фрагмент фото `duplicate` / `continuation` (после блока N) / `new`, студент подтверждает план. В .docx фото встраиваются картинками.
- **«Законспектировать»** — два прохода DeepSeek на каждый диапазон кусков (`POST /api/lecture/[id]/structure`): `cleanTranscript` восстанавливает сказанное (созвучные ошибки Whisper, мусор, галлюцинации «Субтитры сделал…»), затем `structureTranscript` пишет конспект. Пустой результат НЕ двигает `processedSeq`; клиент (`useLectureSession`) считает незаконспектированным всё, что не покрыто секциями `aiSection` (`coveredSeqs`), и ручная кнопка добирает пробелы пакетами ≤5 мин, вставляя секцию на место по порядку записи.
- **Доска в конспекте** — узел `boardBlock` (`src/widgets/Lecture/board/`): полноэкранный `CallWhiteboard` звонка (пропсы `initialScene`/`onSceneApi` — только для лекции, звонок их не передаёт), сцена хранится в attrs узла, снимок PNG (`boardSnapshot.ts`, 3D-зоны проецируются вручную) — для превью/PDF/.docx. ИИ по фото доски может вернуть ` ```board {spec}``` ` (`boardSpec.ts`) → сцена строится `buildSceneFromSpec`.
- **Графики** — узел `graphBlock` (`src/widgets/Lecture/graph/`): спецификация (`src/shared/lib/lecture/graphSpec.ts`, валидация `parseGraphSpec`) рисуется **recharts** (библиотека графиков приложения — не писать свой рендер); функции сэмплирует `samplePlot` через безопасный парсер `mathExpr.ts` (без eval: `2sin x`, `|x|`, `x^(1/3)`). Типы: `plot` (fn с `from/to` = кусочные, `area`, `points`, `line` по данным, `vline/hline`) и `bar` (столбцы+линии). Word получает PNG-снимок (`snapshotChart` → LecturePhoto, `snapOf` = спека снимка; изменённая спека переснимается сама). ИИ: ` ```graph {json}``` ` в диалекте (конспект, фото доски) и `POST /api/lecture/[id]/graph` (describe/edit/photo). Пустой блок (вставили и не заполнили) выкидывается при загрузке.
- **Матрицы** — `MatrixDialog` (`src/widgets/Lecture/matrix/`) + точная арифметика в дробях `src/shared/lib/lecture/matrix.ts` (`Frac` на bigint: det, обратная, ранг, Гаусс/Жордан, транспонирование); результат — обычный `mathBlock` (в матрицах `\dfrac`, иначе строки наезжают). Выделенная формула-матрица открывается в инструменте снова (`parseMatrixLatex`).
- **Размер и выравнивание** — текст: `FontSize` (из `@tiptap/extension-text-style`) + `@tiptap/extension-text-align` (paragraph/heading), панель над круглыми кнопками «Текст» (`FormatPanel`); формулы: attrs `size` (шаги `MATH_SIZES`) у `mathInline`/`mathBlock` и `align` у `mathBlock`, кнопки −/+ и ⟸≡⟹ в плашке формулы. Масштаб формулы — CSS `zoom`, не `font-size`: глобальный reset `src/shared/scss/main.scss` прибивает всем `span` `15px`; там же правило `.ML__latex span:not([class*='size']):not(.ML__vlist-s) { font-size: inherit }`, без него mathlive-вёрстка (дроби, матрицы) слипается. Матрицы с дробями пишутся с `\\[6pt]` между строк. В .docx: `fontSize` → `size` рана, `textAlign` → `alignment`, размер формулы → `w:sz` на каждом `m:r`, положение → `m:jc` + выравнивание абзаца.
- **Контекст лекции** — `LectureNote.context` (`src/shared/lib/lecture/context.ts`): предмет, тема, подтемы, термины. DeepSeek обновляет его на каждом `/structure` (ответ — JSON `{markdown, context}`), он подмешивается во все промпты (`contextPrompt`) и в подсказку Whisper (`sttHint`, без LaTeX). Правка студентом через `PATCH /api/lecture/[id] {context}` закрепляет поле (`pinned`) — ИИ его больше не меняет. Правило `CONTEXT_RULE` в `ai.ts`: достраивать неразборчивое по типичным формулам темы только при очевидном совпадении, иначе `==[неразборчиво]==`.
- **Никогда не отдавать публичный URL бакета** для скачивания/просмотра — браузеры помечают его домен как опасный. Скачивание «Моих файлов» — `GET /api/student-files/files/[id]/download` (стрим, attachment, без лимита 20 МБ).
- **Механизм тарифа скрыт**: ученик/репетитор видят только сумму; параметры (`LectureSettings`) отдаются только админам, а подписи админской карточки лежат в `src/shared/lib/lecture/tariffLabels.ts` и приходят из админского API — НЕ класть их в `messages/*.json` (корневой layout отдаёт все сообщения каждому посетителю).
- Подводные камни: рекордер — синглтон вне React (`recorder/lectureRecorder.ts`), стартует в клике на `/lecture` (жест нужен Safari) и переживает переход на `/lecture/[id]`; глобальный `TextSelectionProvider` на `/lecture` выключен (у редактора своё меню). Локальная проверка без S3 не сохранит в файлы (502 `UPLOAD_FAILED`) — поднимай `s3rver`.
- **Промо на главной** — `src/_pages/PublickPages/LandingPage/LecturePromo/` (один блок, namespace `lecturePromo`): слева заголовок + плитки инструментов, справа карточка «запись → чистка → конспект с графиком»; анимация (зачёркивание шума, появление текста, рисование графика через `pathLength`/`stroke-dashoffset`) идёт по классу `.play`, который ставит IntersectionObserver один раз; при `reduced-motion` сразу финальный кадр.
- **Раскладка `/lecture/[id]`** — на десктопе боковые колонки `sticky` высотой `100vh − шапка − отступ` (у `.page` обязательно `overflow-x: clip`, не `hidden` — иначе sticky ломается); ≤1100px обе колонки — одна выдвижная панель справа с табами «ИИ»/«Инструменты» (язычок `.drawerToggle`, как `tabletProfileToggle` в дашборде), над документом остаётся полоса записи `.mobileRec`.
- **Живая доска в тексте** — `BoardView`: снимок по умолчанию, «Крутить здесь» монтирует `BoardEditorDialog` с `inline` прямо в блоке (фигуры двигаются/вращаются на месте), «На весь экран» — тот же редактор поверх страницы с передачей несохранённой сцены. `BoardBlockNode` задаёт свой `stopEvent` (события внутри `.lecture-board-live` не трогает ProseMirror) и гасит `dragstart`; attr `size` s/m/l — ширина блока в конспекте и доля ширины картинки в .docx.
- **Матрица при правке** — любая формула-матрица (`A = …`, `A^{-1} = …`, `\det A = |…| = −3`; `parseMatrixLatex`) по карандашу/двойному клику и по кнопке «Матрица» открывается в `MatrixDialog` через `openMatrix()` / `matrixEditBus` (диалог смонтирован в `LectureEditor`), хвост определителя пересчитывается; уравнение из двух матриц — в обычный редактор формул.
- **Заметки** — `span.lecture-note` залит на всю высоту строки (`box-decoration-break: clone`), при наведении `NoteHoverTip` показывает текст заметки над первой строкой (все куски заметки подсвечиваются вместе).
- **Без служебных пометок** — ИИ не пишет `[неразборчиво]`, «(по контексту не восстановить)», «Примечание: … распознавания»; правило в `CONTEXT_RULE` + страховка `stripMeta()` (`ai.ts`, вызывается из `stripFence` и для кусков фото). Не возвращать `==[неразборчиво]==` в промпты.
- **Сжатие конспекта** — табы без/среднее/сильное (`Compression`, `COMPRESSION_RULE` в `ai.ts`), выбор в localStorage `gw-lecture-compression:<id>`, уходит в `/structure` полем `compression` (дефолт `none`).
- **Куда встаёт новый раздел** — `sectionInsertPos()` (`docOps.ts`): перед первым `aiSection` более позднего звука (добор пропуска), иначе — в самый конец документа. Исключение — строгое «дополнение»: клиент шлёт в `/structure` заголовки прежних разделов (`sectionTitles`), ИИ может вернуть `continues: N` только если преподаватель явно вернулся к той теме и весь фрагмент — её дополнение (правило «КУДА ВСТАВИТЬ» в `STRUCTURE_SYSTEM`, по умолчанию `null`); тогда раздел встаёт сразу после N и студенту показывается тост, куда он ушёл. Не «сразу после предыдущего раздела»: свой текст студента, фото доски и перенесённые руками темы оказывались ниже новой темы (СЛАУ вставала в середину матриц).
- **«Законспектировать сейчас»** — остаток = куски, не покрытые `aiSection` и без `LectureChunk.noContent`. Флаг ставит `/structure` при пустом результате, если клиент прислал `markEmpty` (принудительный прогон или полный пакет) — иначе пустые хвосты возвращались в счётчик после перезагрузки.
- **«Спросить ИИ»** — галочка «Вставить после выделенного» (`insertAfter` → режим «ДОБАВЛЕНИЕ» в `ASK_SYSTEM`, блоки вставляются после блока выделения); ИИ умеет markdown-таблицы → узлы `table` (`TableKit`, `resizable: false`) → таблица Word в `docx.ts`.
- **Фото доски по одному статусу**: `PhotoMergeDialog` готовит каждое фото отдельно — не открылось (`preparePhoto` бросает `UNREADABLE`, если браузер не декодирует файл, напр. HEIC), слишком большое, отклонено сервером (`photosFromForm` возвращает `index` фото), не загрузилось — у этого фото своя ошибка и «Повторить», остальные можно разобрать кнопкой «Продолжить без них». Раньше `dims()` глотал ошибку декодирования и битый файл валил весь vision-запрос.
- **Три попытки на каждый запрос с фото** (`callVisionAI`, `src/lib/openrouter.ts`): vision-модель ×2, затем `deepseek-chat` (он тоже принимает картинки и читает доску сразу — `deepseek-v4-flash-vision-exp` иногда отвечает пустым текстом). Неудача попытки — пустой ответ, битый JSON (если просили JSON), отказ `validate`, ошибка/таймаут (50 с на попытку, маршруты фото — `maxDuration 180`). Не вышло и так → на клиенте `photoFailedToast()` (`photoTools.ts`) с «Повторить», которая шлёт те же фото заново (исправление по фото, «В текст», вставка с фото, формула и график по фото; в «Обработать фото доски» — своя плашка с «Повторить»).
- **Фото доски** — до `MAX_PHOTOS = 6` за раз (`photosFromForm`, один vision-запрос на все), «Вставить фото» по умолчанию выключено.
- **Главы в .m4a** — `buildLectureAudio(id, lang)` после склейки дописывает главы (`m4aChapters.ts`: Nero `chpl` + QuickTime-трек глав через `tref/chap`, moov переносится в конец со сдвигом `stco`), разметка — `lectureMarkers()` (`audioFile.ts`): раздел = заголовок, формула/график/доска/фото — пин по позиции в разделе, ближе 20 с не ставятся. stt-server не менялся. Любая ошибка разбора MP4 → исходный файл без глав.
- **Живая доска в тексте не должна двигать страницу**: пока `live`, `BoardView` снимает `draggable` с внешнего `.react-renderer` и глушит `dragstart`, а `LectureEditor` в `handleScrollToSelection` не скроллит, если фокус/hover внутри `.lecture-board-live`. Шаблоны в инлайн-режиме скрыты (`CallWhiteboard hideTemplates`).
- **Порядок блоков главной**: доска (VideoSection) → календарь → учителя → конспект (LecturePromo) → курсы → остальное.
- **Таблицы в ответах ИИ**: `protectTablePipes()` (`markdownToDoc.ts`) экранирует `|` внутри `{red|…}` и `$…$` в строках таблицы — иначе GFM режет их на ячейки.
- **Публичные ссылки** (`src/shared/lib/lecture/share.ts`): `LectureNote.shareViewToken` / `shareEditToken` (включает/отзывает владелец, `POST/DELETE /api/lecture/[id]/share`, панель `ShareLinks` в правой колонке), страница `/lecture/shared/[token]` без логина (`SharedLecture`, `noindex`). API ссылки — `app/api/lecture/shared/[token]/*` (документ, PATCH только у edit, фото). `LectureEditor` получает `lectureId="shared/<token>"` — статический сегмент `shared` перекрывает `[id]`, поэтому все запросы редактора сами уходят в маршруты ссылки. По ссылке ИИ нет (`canUseAi=false`, `boardAccess` сброшен) — он платится из тарифа владельца. Фото гостя идут в квоту владельца.
- **Версии документа**: `LectureNote.docVersion` растёт на каждом сохранении `docJson` (`saveDoc()`: `updateMany where docVersion = base`). И владелец, и гость шлют `baseVersion`; устаревший → 409 `CONFLICT` с новым doc, клиент показывает его (`setContent(..., { emitUpdate: false })` — без эха-сохранения). Пока есть edit-ссылка, владелец опрашивает `GET /api/lecture/[id]/doc?since=` раз в 5 с, гость — `GET /api/lecture/shared/[token]?since=` раз в 4 с (и видит запись лекции вживую). Реалтайм-слияния нет: при одновременной правке побеждает сохранивший первым.
- **Раскладка `/lecture/[id]` на десктопе (>1100px)** — «как приложение»: `.page` ровно `100dvh − --lecture-top` (отступ сверху меряется в `LectureWorkspace`, не угадывается), окно не скроллится, левая колонка / документ / правая колонка скроллятся независимо. ≤1100px — прежняя мобильная раскладка.
- **Папки по предметам** (`src/shared/lib/lecture/subjects.ts`): «Сохранить в файлы» кладёт конспект в `Конспекты лекций/<Предмет>` (предмет — `context.subject`). Ученик: переиспользуется его папка с таким именем где угодно; репетитор — только внутри «Конспекты лекций» (одноимённая папка библиотеки может быть открыта ученикам). Сохранённый раньше в корень конспект (и его .m4a) переезжает в папку предмета при следующем сохранении. Фильтр «Предмет» (`SubjectFilter`, `GET /api/lecture/subjects`) — в «Моих файлах» (новый `GET /api/student-files/search?q=&subject=`) и в библиотеке репетитора (`subject` в `/api/tutor-files/search`): файлы лекций этого предмета + всё внутри папок с его именем.
- **Память lecture-stt**: `/concat` кодирует по одному куску (весь PCM лекции в памяти — ~0,5 ГБ на 80 мин), после каждого запроса `gc` + `malloc_trim`, в Dockerfile `MALLOC_ARENA_MAX=2`, потоки ограничены (`CPU_THREADS=4`, `DRAFT_WORKERS=1` по умолчанию), большая модель выгружается после `FINAL_IDLE_S` (300 с) простоя. Локально: пик ~750 МБ, покой ~520 МБ с моделью `small`.
