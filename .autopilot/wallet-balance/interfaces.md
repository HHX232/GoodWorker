# Интерфейсы — Баланс/кошелёк вместо прямой покупки VIP

Копия границ из `spec.md` §«Границы и швы» + то, что субагент не выведет сам из репозитория.
Каждый субагент читает этот файл перед тем, как написать хоть строку, и по возвращении
дописывает сюда, что реально построил (сигнатуры могли уточниться по ходу).

## Стек и команды (проект, не эта фича)

- Next.js (App Router) + Prisma + PostgreSQL. `npm run dev` — старт на `:3000`.
- Миграции: `set -a; source .env; set +a && npx prisma migrate dev --name <slug>` в разработке
  (или `migrate deploy` в проде — но это уже не забота субагента). После правки
  `prisma/schema.prisma` — обязательно `npx prisma generate`.
- Тестового раннера в проекте фактически нет — верификация через `curl` к поднятому
  `npm run dev` с логином по сид-аккаунтам (`teacher@seed.dev`/`student@seed.dev`,
  пароль `password123`, см. рецепт логина в `CLAUDE.md` корня репозитория).
- Роль в сессии: `session.user.role` может быть `ADMIN` для сид-репетитора — там, где код
  различает TEACHER/STUDENT, трактовать `ADMIN` как `TEACHER` с тем же `id` (паттерн уже
  использован в `src/shared/lib/chat/access.ts`, `app/api/teacher/calendar` и др. — **копировать
  паттерн**, не импортировать `getChatSessionUser` из чат-модуля напрямую: кошелёк не должен
  зависеть от модуля чата).
- i18n — `next-intl`, все строки в `messages/{en,hi,ru,zh}.json`, новые ключи — во все 4 файла
  одновременно, даже если для какой-то локали в похожем месте уже есть исторический пробел.
- Недостающую зависимость не ставим — возвращаем `BLOCKED`. Новый npm-пакет не нужен нигде
  в этой фиче (всё на уже используемых Prisma/Next.js/next-intl).

## Что нельзя трогать

- `app/api/call/analyze-errors/route.ts` — бесплатная фича, биллинг сюда не заходит.
- Любые `isVip`/`vipExpiresAt`-проверки **вне** 7 AI-эндпоинтов этого брифа (лимит участников
  звонка `app/api/call/rooms/limit`, видимость VIP-постов/roadmap, профильные бейджи,
  `/vip`-страница и `teacher/vip/activate`, промокоды/рефералка, админ-статистика) —
  не редактируются, VIP там остаётся ровно тем, чем была.
- Гостевой (без сессии) путь `pdf-to-test` (`isGuest`) — не должен получить требование логина
  или баланса. Билинг применяется только когда `session?.user` существует.
- Тарифная логика на лимит страниц/форматов в `pdf-to-test` и `tests/import-pdf`
  (VIP → 50 стр./любой формат, не-VIP → 5 стр./только PDF) — не меняется вообще, баланс
  списывается уже поверх того, что тариф разрешил обработать.
- `VipTransaction` — не переиспользуется под списания за AI (это леджер про VIP-дни).
  Новый леджер денег — отдельная модель `WalletTransaction`.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `src/shared/lib/wallet/pricing.ts` | тарифы DeepSeek, пик/непик, наценка, оценки максимума на эндпоинт | `computeCostCents(usage, at)`, `estimateMaxCostCents(endpoint, promptChars, at)`, `isPeak(at)` | таблицу ставок, формулу округления |
| `src/shared/lib/wallet/wallet.ts` | баланс, леджер, VIP-бонус за депозит | `getBalanceCents(user)`, `preflightCheck(user, maxCostCents)`, `chargeForAICall(user, endpoint, usage, at)`, `depositMock(user, amountCents)`, `listTransactions(user, cursor)` | атомарность `updateMany`, математику продления `vipExpiresAt` |
| `src/lib/openrouter.ts` (расширяется) | вызов AI-провайдера | `callAI`/`callVisionAI` теперь возвращают `{content, usage}` вместо голой строки | парсинг SSE, выбор провайдера |
| 7 route-хендлеров (см. список ниже) | HTTP-контракт своей фичи | без изменений наружу (тот же URL/форма успешного ответа) + новый 402-путь при нехватке средств | вызов preflight/charge внутри себя |
| `app/api/wallet/*` (новые) | HTTP-контракт кошелька | `GET /api/wallet/balance`, `POST /api/wallet/topup`, `GET /api/wallet/transactions` | обращение к `wallet.ts` |
| `src/widgets/Wallet/*` (новые) | отображение баланса/истории/формы пополнения | React-компоненты, без экспорта бизнес-логики | фетч из `/api/wallet/*` |

### Тип `AIUsage` (общий контракт `openrouter.ts` ↔ `pricing.ts`)

```ts
export type AIUsage = {
  promptCacheHitTokens: number
  promptCacheMissTokens: number
  completionTokens: number
} | null // null — usage недоступен (openrouter-фолбэк без DEEPSEEK_API_KEY) → себестоимость $0
```

### Формула цены (`computeCostCents`)

Ставки за 1,000,000 токенов, в долларах — переводить в центы за токен внутри функции,
округление вверх до целого цента на весь вызов (не на каждый токен):

| | Непик | Пик |
|---|---|---|
| Вход, кэш-промах | $0.15 | $0.30 |
| Вход, кэш-попадание | $0.003 | $0.006 |
| Выход | $0.60 | $1.20 |

`isPeak(at)`: `true`, если UTC-время `at` попадает в 01:00–04:00 **или** 06:00–10:00,
и день недели (UTC) — Пн–Пт. Иначе `false`. Китайские праздники не учитываются (см. spec
«Вне рамок» — известное ограничение, не баг).

`costCents = ceil( (promptCacheMissTokens × missRate + promptCacheHitTokens × hitRate + completionTokens × outRate) / 1_000_000 × 100 × (1 + AI_MARKUP_PERCENT/100) )`,
где `missRate/hitRate/outRate` — доллары за миллион по таблице выше в зависимости от `isPeak`.
`AI_MARKUP_PERCENT` — `process.env.AI_MARKUP_PERCENT`, отсутствует → `0`.

Той же таблицей тарифицируется и vision-модель (`deepseek-v4-flash-vision-exp`) — отдельного
тарифа пользователь не называл (см. spec «Открытые места», G05).

### 7 AI-эндпоинтов и их режим биллинга

| Эндпоинт | Было (VIP-гейт) | Станет |
|---|---|---|
| `app/api/whiteboard/formula-ai/route.ts` | `!isVip(room.owner) && !isAdmin` → 403 | гейт снят, preflight+списание с владельца комнаты |
| `app/api/whiteboard/formula-photo/route.ts` | аналогично | аналогично |
| `app/api/pdf-to-test/photos/route.ts` | не-VIP → 403 всегда | гейт снят, preflight+списание с текущего пользователя |
| `app/api/teacher/lesson-plan/route.ts` | `role!==ADMIN && !isVip` → 403 | гейт снят (ADMIN как и раньше бесплатен), preflight+списание с учителя |
| `app/api/teacher/lesson-plan/revise/route.ts` | аналогично | аналогично |
| `app/api/pdf-to-test/route.ts` | VIP расширяет формат/объём, гость — 5 стр. PDF бесплатно | **гейт/тариф не меняется**; если запрос допущен тарифом и это не гость — preflight+списание поверх |
| `app/api/tests/import-pdf/route.ts` | VIP расширяет лимит страниц/фото | **гейт/тариф не меняется**; preflight+списание поверх (TEACHER/ADMIN — тут гостя не бывает) |

Владелец счёта для списания:
- `formula-ai`/`formula-photo` — `room.ownerId`/`room.ownerRole` (не тот, кто нажал кнопку).
- Остальные 5 — текущий `session.user` (через тот же паттерн ADMIN→TEACHER).

### Ошибка нехватки средств (общий контракт всех 7 эндпоинтов)

```json
{ "error": "INSUFFICIENT_BALANCE", "message": "Недостаточно средств: нужно ещё $X.XX", "neededCents": 123, "availableCents": 45 }
```
HTTP 402, до вызова AI-провайдера (preflight) — провайдер не дёргается впустую.

### API кошелька

- `GET /api/wallet/balance` → `{ balanceCents: number, isVip: boolean, vipExpiresAt: string|null }`
- `POST /api/wallet/topup` body `{ amountCents: number }` (валидация `100..100000`) →
  `{ balanceCents: number, vipMonthsGranted: number, vipExpiresAt: string|null }`
- `GET /api/wallet/transactions?cursor=&limit=` → курсорная пагинация (тот же паттерн, что
  `GET /api/chat/conversations/[id]/messages`) →
  `{ items: Array<{id, type: 'DEPOSIT'|'AI_DEBIT', amountCents, balanceAfterCents, endpoint: string|null, description, createdAt}>, nextCursor: string|null }`

## Швы для тестов (ровно два, по спецификации)

1. `pricing.computeCostCents` — чистая функция, юнит-тест на 4 комбинации пик/непик ×
   кэш-хит/промах + наценку через `AI_MARKUP_PERCENT`.
2. `wallet.chargeForAICall` — тест, что условный `updateMany` не уводит баланс в минус при
   параллельных списаниях, и что неуспешный AI-вызов (исключение до `chargeForAICall`)
   вообще не трогает баланс.

## Что построено (заполняется тикетами по ходу)

### Тикет 01 — схема, ценообразование, кошелёк-движок, HTTP-контракт

Сигнатуры не разошлись с планом выше — уточнения:

- `pricing.ts`: `isPeak(at: Date): boolean`, `computeCostCents(usage: AIUsage, at: Date): number`,
  `estimateMaxCostCents(endpoint: string, promptChars: number, at: Date): number`. `AIUsage` типом
  владеет `src/lib/openrouter.ts` (там, где рождается) — `pricing.ts` его импортирует, не наоборот.
  `estimateMaxCostCents` держит таблицу `OUTPUT_TOKEN_CEILING` по ключам-путям 7 эндпоинтов
  (`'whiteboard/formula-ai'`, `'whiteboard/formula-photo'`, `'pdf-to-test/photos'`, `'pdf-to-test'`,
  `'tests/import-pdf'`, `'teacher/lesson-plan'`, `'teacher/lesson-plan/revise'`) — тикеты 02/03
  должны звать её с этими же строками.
- `wallet.ts`: `getWalletSessionUser(): Promise<WalletUser | null>` — своя копия ADMIN→TEACHER,
  экспортируется отдельно (не в интерфейсах изначально, добавилась по ходу — нужна и HTTP-слою
  кошелька, и будущим 7 эндпоинтам). `getBalanceCents(user)`, `preflightCheck(user, maxCostCents)`
  (кидает `InsufficientBalanceError{neededCents, availableCents}`), `chargeForAICall(user, endpoint,
  usage, at): Promise<{costCents, balanceAfterCents, shortfallCents}>`, `depositMock(user,
  amountCents): Promise<{balanceAfterCents, vipMonthsGranted, vipExpiresAt}>` (кидает
  `InvalidDepositAmountError`), `listTransactions(user, cursor?, limit?): Promise<{items, nextCursor}>`.
  `depositMock` — интерактивная `$transaction(async tx => ...)` (не форма-массив), т.к. запись в
  леджер и продление VIP зависят от результата предыдущего шага той же транзакции.
- `openrouter.ts`: `callAI`/`callVisionAI` возвращают `Promise<{content, usage}>`
  (`export type AIResult = {content: string; usage: AIUsage}`). Для openrouter-фолбэка `usage`
  принудительно `null` в `callAI` (провайдеру `stream_options.include_usage` не передаётся).
- HTTP: `GET /api/wallet/balance`, `POST /api/wallet/topup`, `GET /api/wallet/transactions` — ровно
  контракты из этого файла, проверено вживую (`npm run dev` + сид-логин teacher/student):
  валидация суммы, VIP-бонус, курсорная пагинация, 401 без сессии — всё отработало как в спеке.
- Self-check-скрипты (не тест-раннер, `npx tsx`): `pricing.selfcheck.ts` (4 комбинации пик/непик ×
  кэш-хит/промах + округление + наценка + отсутствие наценки — все PASS),
  `wallet.selfcheck.ts` (бьёт по реальной dev БД, создаёт и удаляет одноразовые Teacher-строки —
  три сценария, все PASS): (1) два параллельных списания 100c против баланса 150c — одно проходит
  до 50c, второе гонкой обнуляется до 0 с `shortfallCents=50`, сумма списаний никогда не уводит
  баланс в минус; (2) `usage: null` не трогает баланс и не пишет `AI_DEBIT`; (3) регрессионный тест
  на находку ревью ниже — параллельные `chargeForAICall` (недостаточно средств) и `depositMock` на
  одном счёте: итоговый баланс всегда 950 либо 1000 (согласовано с `shortfallCents` результата
  списания), никогда не 0 — депозит не может быть затёрт обнулением от списания.
- **Правка после ревью:** исходная версия `chargeForAICall` при недостатке средств делала
  `getBalanceCents` (отдельное чтение) и затем безусловный `updateMany({data:{balanceCents:0}})` —
  между этими двумя вызовами было окно гонки: конкурентный `depositMock` мог зачислить деньги
  ровно в этот промежуток, и безусловная запись `0` затирала их. Заменено на `zeroIfBelowCost` —
  один атомарный SQL-запрос (`WITH locked AS (SELECT ... FOR UPDATE) UPDATE ... FROM locked
  WHERE ...`, `$queryRawUnsafe` с параметрами `$1`/`$2`, имя таблицы — из закрытого union-типа
  `'Teacher' | 'Student'`, не из пользовательского ввода), который перепроверяет `balanceCents <
  cost` в момент самой записи и возвращает реально обнулённое значение для точного
  `shortfallCents`. Вокруг обеих атомарных попыток (`decrement`-if-`gte`, затем `zeroIfBelowCost`)
  добавлен ограниченный цикл повторов (`MAX_ATTEMPTS=5`) — на случай, если депозит успевает
  проскочить ровно между двумя атомарными шагами самого списания; после исчерпания попыток (в
  теории возможно, на практике не наблюдалось) вызов остаётся неоплаченным (fail-open) — помечено
  `ponytail:`-комментарием с путём апгрейда до `SERIALIZABLE`-транзакции, если это когда-нибудь
  реально сработает.

### Тикет 03 — списание поверх тарифов `pdf-to-test` и `tests/import-pdf`

Сигнатуры не разошлись с планом — уточнения по реализации:

- `pdf-to-test`: гостевой путь (`isGuest`) не тронут вообще — ни импорта `wallet`-модуля
  на этой ветке, ни обращения к нему. Для залогиненного preflight считается по
  `estimateMaxCostCents('pdf-to-test', aiPrompt.length, at)` **после** извлечения текста
  (когда уже известна длина промпта), но до вызова `callAI` — так преflight не блокирует
  бесплатный шаг извлечения текста микросервисом. Списание — одно, после успешного
  `callAI`, из `result.usage`. Владелец счёта — `getWalletSessionUser()` (VIP-статус тут
  не даёт бесплатного AI, в отличие от `tests/import-pdf` — pdf-to-test и раньше не имел
  admin-бесплатной ветки, поэтому ADMIN здесь тоже платит; подтверждено живым тестом ниже).
- `tests/import-pdf`: `walletUser = isAdmin ? null : await getWalletSessionUser()` —
  ADMIN пропускает биллинг целиком, как и раньше пропускал VIP-гейт. Один преflight
  перед всей AI-секцией (учитывает и текстовые чанки, и фото — `promptChars =
  combinedContent.length + imageFiles.length * VISION_PROMPT_CHARS_PER_PHOTO`,
  `VISION_PROMPT_CHARS_PER_PHOTO=4000` как грубая консервативная поправка на vision,
  помечено `ponytail:`). Все вызовы `callAI` (по чанкам) и `callVisionAI` (фото) собирают
  `usage` в массив; локальный хелпер `sumUsage()` в этом файле схлопывает их в один
  `AIUsage` перед единственным вызовом `chargeForAICall` — одно списание на весь запрос,
  а не по чанку. `CHUNK_SIZE` вынесен из локального блока в константу модуля (использовался
  и в новом preflight-расчёте, и в существующей логике чанкинга).
- Оба файла: 402-контракт `{error:"INSUFFICIENT_BALANCE", message, neededCents,
  availableCents}` собран вручную в каждом файле (не общий хелпер — вне зоны тикета трогать
  нечего, дублирование двух мест признано меньшим злом, чем шарить код между чужими зонами).

**Живая проверка (`npm run dev` + сид-логины), все PASS:**
1. Гость, `pdf-to-test`, маленький PDF → 200, как раньше, без обращения к wallet.
2. `teacher@seed.dev` (роль в сессии `ADMIN`, баланс 0) → `pdf-to-test` → 402
   `INSUFFICIENT_BALANCE` (у `pdf-to-test` нет admin-бесплатной ветки — ожидаемо).
3. `teacher@seed.dev`, `tests/import-pdf`, тот же PDF → 200 (ADMIN бесплатен, как и был) —
   подтверждает, что ADMIN-бесплатность `tests/import-pdf` не сломана.
4. `teachervip@seed.dev` (настоящая роль `TEACHER`, не ADMIN, баланс 0) → `tests/import-pdf`
   → 402 `INSUFFICIENT_BALANCE`.
5. После `POST /api/wallet/topup {amountCents:200}` — оба (`teacher@seed.dev` на
   `pdf-to-test`, `teachervip@seed.dev` на `tests/import-pdf`) → 200, баланс 200→199,
   `GET /api/wallet/transactions` показывает `AI_DEBIT` с правильным `endpoint`.

### Тикет 04 — UI кошелька (бейдж, страница, история)

Контракт API использован буквально, без отклонений от тикета 01. Одна деталь, полезная
для дальнейшей работы: `GET /api/wallet/transactions` уже отдаёт человекочитаемый текст
в поле `description` (например `"Списание за: План урока"`, `"Пополнение баланса на $12.00"`) —
`wallet.ts`'s `HUMAN_ENDPOINT_DESCRIPTION` формирует его на бэкенде при записи в леджер.
UI (`WalletPage.tsx`) поэтому просто рендерит `item.description` как есть, без своей
карты `endpoint → подпись` на фронтенде — дублировать её не пришлось.

Построено: `src/widgets/Wallet/WalletBadge/{WalletBadge.tsx,WalletBadge.module.scss}` (в `Header.tsx`,
рядом с `ChatHeaderIcon`), `app/wallet/page.tsx` + `src/widgets/Wallet/WalletPage/{WalletPage.tsx,WalletPage.module.scss}`,
namespace `wallet` + `PageTitles.wallet` во всех 4 `messages/*.json`. Живьём проверено (`npm run dev`
+ логин `teacher@seed.dev`): бейдж/страница читают `GET /api/wallet/balance`, форма шлёт
`POST /api/wallet/topup` (проверены `$3`→`vipMonthsGranted:0`, `$12`→`vipMonthsGranted:2` +
продление `vipExpiresAt`, сумма `>$1000`→400 `INVALID_AMOUNT`), история — `GET /api/wallet/transactions`
с курсором; без сессии `/api/wallet/balance` → 401, `/wallet` → редирект на `/login`.

### Тикет 02 — замена VIP-гейта на балансовый (5 эндпоинтов)

Сигнатуры не разошлись с тикетом 01 — использованы буквально `preflightCheck(user, maxCostCents)`,
`chargeForAICall(user, endpoint, usage, at)`, `InsufficientBalanceError{neededCents,
availableCents}`, `getWalletSessionUser()`, `estimateMaxCostCents(endpoint, promptChars, at)` с
теми же строковыми ключами эндпоинтов, что в `pricing.ts` (`'whiteboard/formula-ai'`,
`'whiteboard/formula-photo'`, `'pdf-to-test/photos'`, `'teacher/lesson-plan'`,
`'teacher/lesson-plan/revise'`).

- `formula-ai`/`formula-photo`: старая проверка `!isVip(room.owner) && !isAdmin` убрана целиком —
  включая caller-side `isAdmin`-обход (в старом коде это был `session.user.role === 'ADMIN'` **того,
  кто нажал кнопку**, а не владельца комнаты; по таблице спеки «Стало» для этих двух эндпоинтов
  admin-исключения нет вообще). Платёж всегда с владельца комнаты: локальный хелпер
  `roomOwnerWalletUser(room)` строит `WalletUser` напрямую из `room.ownerId`/`room.ownerRole`
  (`STUDENT` → `STUDENT`, иначе `TEACHER`) — это НЕ копия `getWalletSessionUser()` (та читает
  сессию текущего пользователя, а платит владелец комнаты, часто не тот, кто вызвал API), но тот же
  ADMIN→TEACHER принцип: `ownerRole` из `Role`-enum (`STUDENT|TEACHER|ADMIN`) сворачивается к
  двум ролям кошелька. Живой прогон это подтвердил: комната, которой владеет ADMIN-аккаунт
  (`teacher@seed.dev`), при нулевом балансе всё равно получила 402 — старого admin-обхода для
  формул больше нет.
- `pdf-to-test/photos`: старый гейт был не `!isVip && !isAdmin`, а отдельный `resolveVip(email)`
  (403 `{vipRequired:true}` дважды — на отсутствие сессии и на не-VIP). Оба заменены на
  `getWalletSessionUser()` (401 без `vipRequired`, раз VIP тут больше не при чём) +
  `preflightCheck`/`chargeForAICall` с текущим пользователем как плательщиком. Никакого
  ADMIN-исключения у этого эндпоинта не было и не появилось — ADMIN платит как TEACHER (через
  `getWalletSessionUser`'s ADMIN→TEACHER маппинг), это не противоречит тикету: приёмочные критерии
  просили admin-исключение только для двух lesson-plan-эндпоинтов.
- `lesson-plan`/`lesson-plan/revise`: `isAdmin` считается один раз из `session.user.role`, `payer =
  {id: teacherId, role: 'TEACHER' as const}` (локальный литерал, не вызов `getWalletSessionUser()`
  — роль тут уже гарантированно TEACHER/ADMIN по проверке чуть выше, второй сетевой запрос к сессии
  не нужен). `preflightCheck`/`chargeForAICall` пропускаются целиком, если `isAdmin` — сохранена
  бесплатность ADMIN дословно как в спеке.
- Место списания во всех 5 файлах — **после** успешного `parseJSON(raw)`, не сразу после
  `callAI`/`callVisionAI`. Нашлась и исправлена находка ревью: в первой версии `formula-photo`
  `chargeForAICall` стоял ДО `parseJSON`, из-за чего невалидный JSON от провайдера всё равно списал
  бы баланс — перенесено на после успешного парсинга (тот же порядок, что в остальных 4 файлах),
  живым прогоном подтверждено, что списание срабатывает и для валидного, но «пустого» результата
  (422 «не удалось распознать» после валидного JSON — тоже платный вызов, деньги реально потрачены
  на токены), но не для сетевых/парсинг-ошибок (не проверено прицельно инъекцией битого JSON —
  логическая гарантия та же `try/catch`-граница, что уже используется в остальных 4 файлах).
- `estimateMaxCostCents` вызывается с длиной текстового промпта (`desc.length` /
  `userPrompt.length` / `systemPrompt.length + userPrompt.length`) как консервативной оценкой
  входных токенов — для двух vision-эндпоинтов (`formula-photo`, `pdf-to-test/photos`) в оценку
  идёт только длина текстового промпта, без токенов самого изображения (в `pricing.ts` нет модели
  оценки токенов по картинке — вне периметра тикета 02, зона `pricing.ts` не редактировалась).
- 402-тело всюду собрано вручную по контракту `interfaces.md` (`{error: 'INSUFFICIENT_BALANCE',
  message, neededCents, availableCents}`), не через отдельный shared-хелпер — дублирование в 5
  местах, три строки каждое, сознательно не выносилось в общий модуль (вне зоны тикета — 5
  route-хендлеров, не `wallet.ts`).

**Важное для тикетов 02/03:** смена сигнатуры `callAI`/`callVisionAI` на `{content, usage}` ломает
компиляцию не только у 7 эндпоинтов этого брифа, но и у нескольких вызывающих мест ВНЕ периметра
брифа, которые спецификация не упоминала: `src/lib/postAI.ts`, `src/shared/lib/gemini.ts`,
`app/api/calendar/google/import/route.ts`, `app/api/check-answer/route.ts`,
`app/api/tests/generate-title/route.ts`, `scripts/ingest-curriculum.ts`. Это ожидаемо по объёму
задачи тикета 01 (сигнатура меняется только в `openrouter.ts`, роуты не трогаются), но `npm run
build`/`tsc --noEmit` будет красным, пока эти файлы (7 брифовых — тикеты 02/03; остальные —
не назначены ни одному тикету) не адаптируют вызов под новую сигнатуру.
