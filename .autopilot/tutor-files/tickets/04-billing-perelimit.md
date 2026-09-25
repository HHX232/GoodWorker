# 04 — Биллинг перелимита: списание, крон, admin-цена

**Требования:** G02, G02.1, G02.2
**Blocked by:** 01
**Зона:** `src/shared/lib/wallet/wallet.ts`, `app/api/cron/storage-overage-billing/`, `app/api/admin/wallet-settings/`, `src/_pages/AdminPage/AdminPage.tsx` (только `WalletSettingsCard`), `vercel.json`
**Волна:** 2
**Status:** done

## Что должно заработать

Раз в месяц с баланса каждого VIP-репетитора, чей объём файлов превышает 7 ГБ, списывается фиксированная плата за каждый гигабайт перелимита. Админ может задать эту цену. Если денег не хватает — списывается остаток до нуля, хранилище не блокируется.

- `chargeStorageOverage(teacherId, overageGb, priceCentsPerGb, at): Promise<ChargeResult>` в `wallet.ts` — по образцу `purchaseAddon`: атомарный `updateMany({where: {balanceCents: {gte: ...}}})`; **в отличие** от `purchaseAddon` (который бросает `InsufficientBalanceError`), при нехватке применяет zero-floor (как `chargeForAICall`/`zeroIfBelowCost`) — списывает всё, что есть, до нуля, и не бросает исключение (крон работает без пользователя на том конце, останавливаться не на чем). Пишет `WalletTransaction` с `type: STORAGE_OVERAGE_DEBIT`.
- `getWalletPricingSettings`/`setWalletPricingSettings` — добавить `storageOveragePriceCentsPerGbMonth` в сигнатуру и возвращаемый тип, по образцу `featuredPostsPriceCentsPerMonth`.
- `PATCH /api/admin/wallet-settings` — добавить валидацию нового поля (`MIN_STORAGE_OVERAGE_PRICE_CENTS`/`MAX_...`, по образцу существующих констант для других полей).
- `WalletSettingsCard` (в `AdminPage.tsx`) — добавить поле ввода цены за ГБ/мес, тем же способом, что уже есть для `featuredPostsPriceCentsPerMonth`.
- `app/api/cron/storage-overage-billing/route.ts` — `GET`, `Authorization: Bearer $CRON_SECRET` (401 без него), по образцу `app/api/cron/close-stale-rooms/route.ts`. Логика: выбрать всех `Teacher` с `isVip: true` (и `vipExpiresAt` не истёк, если применимо — сверить с существующей проверкой VIP-статуса в проекте), для каждого посчитать `usedBytes` через `getUsedBytes`, если `usedBytes > QUOTA_BYTES` — `overageGb = Math.ceil((usedBytes - QUOTA_BYTES) / 1024**3)`, вызвать `chargeStorageOverage`.
- `vercel.json` — добавить в массив `crons`: `{"path": "/api/cron/storage-overage-billing", "schedule": "0 3 1 * *"}` (03:00 UTC 1-го числа каждого месяца), не трогая существующую запись `close-stale-rooms`.

Цена по умолчанию — `0` (заглушка, задокументирована в спецификации §«Открытые места»). Крон, вызванный при цене `0`, просто ничего не спишет (`overageGb * 0 = 0`) — это ожидаемое поведение, не баг, пока админ не впишет цену.

## Из брифа, дословно

> «лимит фиксированный, если превышает лимит то идет снятие денег со счета (отдельная ветка где vip идет за пополнение счета)» (ответ на брифинге, зафиксировано в манифесте как G02)

## Разделы спецификации

Истории 26–28 (G02, G02.1, G02.2). Решения §Биллинг.

## Критерии приёмки

- [ ] `chargeStorageOverage` при достаточном балансе списывает ровно `overageGb * priceCentsPerGb`, пишет `WalletTransaction` с верным `balanceAfterCents`
- [ ] `chargeStorageOverage` при недостаточном балансе списывает остаток до 0, не бросает ошибку, транзакция всё равно записывается
- [ ] Юнит-тест на оба сценария (обычное списание и zero-floor) — см. шов в `interfaces.md`
- [ ] `GET /api/cron/storage-overage-billing` без корректного `CRON_SECRET` — 401
- [ ] Крон не трогает репетиторов, у которых объём ≤ 7 ГБ, и не-VIP репетиторов
- [ ] Админ может изменить `storageOveragePriceCentsPerGbMonth` через существующий `PATCH /api/admin/wallet-settings` и увидеть поле в `WalletSettingsCard`
