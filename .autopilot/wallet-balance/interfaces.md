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

**Важное для тикетов 02/03:** смена сигнатуры `callAI`/`callVisionAI` на `{content, usage}` ломает
компиляцию не только у 7 эндпоинтов этого брифа, но и у нескольких вызывающих мест ВНЕ периметра
брифа, которые спецификация не упоминала: `src/lib/postAI.ts`, `src/shared/lib/gemini.ts`,
`app/api/calendar/google/import/route.ts`, `app/api/check-answer/route.ts`,
`app/api/tests/generate-title/route.ts`, `scripts/ingest-curriculum.ts`. Это ожидаемо по объёму
задачи тикета 01 (сигнатура меняется только в `openrouter.ts`, роуты не трогаются), но `npm run
build`/`tsc --noEmit` будет красным, пока эти файлы (7 брифовых — тикеты 02/03; остальные —
не назначены ни одному тикету) не адаптируют вызов под новую сигнатуру.
