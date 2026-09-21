# 01 — Схема, движок цены/баланса, HTTP-контракт кошелька

**Требования:** R01, R02, R02.1, R03, R09, R10, R10.1/R16i, R11, R11.1, R11.2, R12, R13, R14i, R14i.1, R14i.2, R15i, G04, G05, G06
**Blocked by:** —
**Зона:** `prisma/schema.prisma`, `prisma/migrations/`, `src/shared/lib/wallet/`, `src/lib/openrouter.ts`, `app/api/wallet/`
**Волна:** 1
**Status:** ready

## Что должно заработать

Фундамент, от которого зависят все остальные тикеты. После этого тикета:
- у `Teacher` и `Student` есть `balanceCents`, и есть таблица `WalletTransaction` с историей;
- есть чистая функция, которая по реальному usage токенов DeepSeek и времени считает
  стоимость вызова в центах (пик/непик, кэш-хит/промах, наценка из `AI_MARKUP_PERCENT`);
- есть функции атомарного списания/пополнения/чтения баланса;
- `callAI`/`callVisionAI` возвращают usage вместе с текстом, а не только текст;
- работают 3 HTTP-эндпоинта кошелька: баланс, мок-пополнение (с VIP-бонусом), история.

Ни один из 7 AI-эндпоинтов в этом тикете не трогается — их переключение на баланс делают
тикеты 02/03, они будут звать функции, которые здесь появятся.

## Из брифа, дословно

> «вместо покупки VIP создать пополнение счета собственного, где при пополнении от 5 долларов
> выдается вип на месяц, и так за каждые 5 баксов условно, за всякие ИИ фичи мы снимаем
> стоимость + проценты»
> «Я бы хотел сделать полнстью функционал - мок оплата (пополнение баланса), отображение
> баланса, обработка потраченных средств на ИИ и снятие их со счета»

И из ответа на брифинг (дословно, см. `manifest.md` G04): «каждый запрос это н-ое число
токенов. Стоимость токенов модели дипсик мы знаем: Ввод (кэш-промах) $0.15/$0.30
(непик/пик), Ввод (кэш-попадание) $0.003/$0.006, Вывод $0.60/$1.20. Поверх еще % из
переменной добавляем».

## Разделы спецификации

Решения §«Схема данных», §«Ценообразование», §«Захват реального usage», §«Списание и
защита от гонки», §«Мок-пополнение и VIP-бонус», §API. Границы и швы — оба шва.
Истории 1–3, 9–13, 14i–17i.

## Критерии приёмки

- [ ] `prisma/schema.prisma`: `Teacher.balanceCents Int @default(0)`, `Student.balanceCents Int @default(0)`, модель `WalletTransaction` (поля и индексы — см. `interfaces.md`/spec), enum `WalletTransactionType { DEPOSIT AI_DEBIT }`; миграция создана и применена, `npx prisma generate` прогнан
- [ ] `src/shared/lib/wallet/pricing.ts`: `isPeak(at: Date): boolean` по правилу 01:00–04:00 и 06:00–10:00 UTC, Пн–Пт; `computeCostCents(usage: AIUsage, at: Date): number` — 0, если `usage === null`; `estimateMaxCostCents(endpoint: string, promptChars: number, at: Date): number` с потолком выходных токенов на каждый из 7 эндпоинтов
- [ ] Юнит-тест/self-check на `computeCostCents`: все 4 комбинации пик/непик × кэш-хит/промах дают ожидаемое число центов, и наценка через `AI_MARKUP_PERCENT` (заданную и незаданную — 0%) применяется корректно
- [ ] `src/lib/openrouter.ts`: `callAI`/`callVisionAI` возвращают `{ content, usage }`; в запрос к DeepSeek добавлен `stream_options: {include_usage: true}`; `readStream` собирает `usage` из финального SSE-чанка (поля `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`/`completion_tokens`; при отсутствии разбивки кэша — весь `prompt_tokens` как кэш-промах); путь без `DEEPSEEK_API_KEY` (openrouter-фолбэк) возвращает `usage: null`
- [ ] `src/shared/lib/wallet/wallet.ts`: `getBalanceCents`, `preflightCheck` (кидает `InsufficientBalanceError` с `{neededCents, availableCents}`, если `estimateMaxCostCents` > текущего баланса), `chargeForAICall` (атомарный `updateMany` с `balanceCents: {gte: cost}`; при `count===0` — обнуление вместо ухода в минус + запись `shortfallCents` в леджер; успешное списание — запись `WalletTransaction(type: AI_DEBIT)`), `depositMock` (валидация `100..100000` центов, `increment` баланса, `vipMonths = floor(amountCents/500)`, при `>0` продление `vipExpiresAt` тем же способом, что `teacher/vip/activate/route.ts`, + запись `VipTransaction(type: DEPOSIT)`), `listTransactions` (курсорная пагинация)
- [ ] Резолюция пользователя из сессии (ADMIN→TEACHER) — своя копия паттерна внутри `wallet`-модуля, не импорт из `src/shared/lib/chat/access.ts`
- [ ] Self-check/тест на `chargeForAICall`: два параллельных списания при недостаточном для обоих балансе — суммарно списывается не больше исходного баланса, ни одно не уходит в минус; вызов без `usage` (провалившийся AI-запрос до получения ответа) не создаёт `AI_DEBIT`-транзакцию
- [ ] `GET /api/wallet/balance`, `POST /api/wallet/topup`, `GET /api/wallet/transactions` — контракты ровно как в `interfaces.md`; пользователь берётся строго из сессии, id никогда не принимается в теле запроса
- [ ] `.env.example` содержит `AI_MARKUP_PERCENT=` (пусто — без выдуманного значения)
- [ ] По возвращении — дописать в `interfaces.md` раздел «Что построено»: финальные сигнатуры, если они уточнились по ходу работы
