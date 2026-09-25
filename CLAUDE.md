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

# GoodWorker — хранилище файлов репетитора (`tutor-files`)

Страница `/files` (VIP-репетитор и его ученики); ссылки — иконка в шапке, подменю профиля, ячейки «Хранилище» / «Файлы от репетиторов» в полосе статистики профиля. Эта сборка — **без Кошелька**: хранилище входит в VIP, квота (админка → Хранилище, по умолчанию 15 ГБ) — жёсткий потолок, загрузка сверх — 413 `QUOTA_EXCEEDED`. Контракты и история — `.autopilot/tutor-files/interfaces.md`.

- API `app/api/tutor-files/*`: `library` (read-модель для обеих ролей — браузинг идёт только через неё), `folders`, `files`, `grants`, `search`, `usage`, `limits`, `links`; админские — `app/api/admin/storage`, `app/api/admin/tutor-files/*` (тихий просмотр, ничего не пишет в `TutorFileOpen`/`TutorFolderOpen`).
- `src/shared/lib/tutorFiles/billing.ts` — единственная точка связи с Кошельком; здесь `STORAGE_BILLING_ENABLED = false`, `getStoragePricing() → null`. Wallet-сборка меняет только этот файл (+ крон и поле цены в админке).
- Видимость ученику — только через `loadStudentVisibility()`/`canStudentSee()` (`src/shared/lib/tutorFiles/access.ts`), с учётом окна доступа `activeGrantWhere()`; `restrictedToStudentId` бывает только у листовых личных подпапок.
- Prisma-клиент (`src/shared/prisma/prisma.ts`) по умолчанию omit-ит `TutorFile.contentText` (текст для поиска внутри файлов) — выбирать явно; тип строк — `TutorFileRow`.
- Клиент импортирует типы из `src/shared/types/TutorFiles/tutorFiles.types.ts` и константы из `src/shared/lib/tutorFiles/constants.ts` — не `access.ts`/`storage.ts` (тянут Prisma).
- `/content`-роуты всегда отдают `application/octet-stream` + `attachment` + `CSP: sandbox` (загруженный учеником .html не должен исполниться на нашем домене).
