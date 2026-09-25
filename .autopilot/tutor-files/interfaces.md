# Интерфейсы — Хранилище файлов репетитора

Источник границ: `spec.md` → «Границы и швы». Здесь — то же самое, плюс контракты между тикетами и правила проекта, которые исполнитель не выведет сам.

## Правила проекта (читать перед кодом)

- Стек: Next.js (App Router) + Prisma + PostgreSQL, SCSS-модули, `next-intl`, TanStack Query на клиенте, `lucide-react` для иконок.
- Работаем **в worktree `/Users/nikitatisevic/Desktop/GoodWorker-wallet-wt`, ветка `feature/wallet-balance-topup`** (продолжение 05–07 и доревью 02–04 — в облачной сессии, ветка `claude/determined-wozniak-ga0gfz`, растёт от `feature/wallet-balance-topup`) — НЕ в `/Users/nikitatisevic/Desktop/GoodWorkerRemaster` (main). Кошелёк (`Wallet*`, `balanceCents`, `purchaseAddon`, `InsufficientBalanceModal`, `/wallet`) уже существует именно здесь, на main его нет.
- Команды: `npm run dev`, `npx prisma generate` после правки схемы, миграции — `set -a; source .env; set +a && npx prisma migrate dev` (локально пишем обычную dev-миграцию, не deploy).
- Тестового раннера в проекте нет — верификация через `curl` к поднятому `npm run dev` (см. сид-аккаунты и рецепт логина в CLAUDE.md) + смоук в браузере для UI-тикетов.
- i18n: новый namespace `files` добавляется в `messages/en.json`, `messages/hi.json`, `messages/ru.json`, `messages/zh.json` — одновременно, во всех четырёх, даже если добавляет один тикет.
- Тёмная тема: в конце каждого `*.module.scss` — блок `:global(html.theme-dark), :global(html.pomodoro-dark) { … }`, переопределяющий только цвета.
- Роль в сессии: `session.user.role` может быть `ADMIN` для сид-репетитора — везде разбирать как `TEACHER` с тем же `id` (см. `getChatSessionUser()` в `src/shared/lib/chat/access.ts` — новый `getFilesSessionUser()` копирует этот паттерн).
- Недостающая зависимость — не ставим, возвращаем `BLOCKED`.

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `src/shared/lib/tutorFiles/access.ts` | правила видимости/владения (включая правило «учебных» подпапок) | `getFilesSessionUser()`, `canStudentSee(item, studentId)`, `requireOwnedFolder()`, `requireOwnedFile()`, `hasTeacherStudentLink()` (реэкспорт из chat/access) | обход `ancestorIds`, ADMIN→TEACHER маппинг |
| `src/shared/lib/tutorFiles/storage.ts` | Prisma-модели `TutorFolder/TutorFile/TutorFolderGrant/TutorFileGrant`, подсчёт `usedBytes` | CRUD-функции над папками/файлами/грантами, `getUsedBytes(teacherId)`, `QUOTA_BYTES` (константа 7 ГБ) | автосоздание «учебных» подпапок при выдаче гранта на папку с `allowStudentUpload` |
| `src/shared/lib/wallet/wallet.ts` (расширяется) | баланс, `WalletTransaction`, ценообразование | новая `chargeStorageOverage(teacherId, overageGb, priceCentsPerGb, at)`; существующие `purchaseAddon`/`chargeForAICall`/`insufficientBalanceResponse`/`getWalletPricingSettings` (расширяется полем `storageOveragePriceCentsPerGbMonth`) | атомарность списания, zero-floor |
| `app/api/tutor-files/folders/*`, `app/api/tutor-files/files/*` | HTTP-контракт CRUD папок/файлов | REST-эндпоинты | — |
| `app/api/tutor-files/grants/*`, `app/api/tutor-files/search`, `app/api/tutor-files/usage` | HTTP-контракт доступа/поиска/квоты | REST-эндпоинты | — |
| `app/api/cron/storage-overage-billing` | ежемесячный проход по перелимитным VIP-репетиторам | `GET` с `Authorization: Bearer $CRON_SECRET` | — |
| `src/widgets/Files/` | вся отрисовка (обе стороны — репетитор/ученик) | `<FilesShell role="teacher"|"student">` | вёрстку карточек/модалок/предпросмотра |

Швы для тестов: `tutorFiles/access.canStudentSee()` (юнит-тест на правило видимости, включая «учебные» подпапки) и `wallet.chargeStorageOverage()` (юнит-тест на обычное списание и на zero-floor). Остальное — через API-роуты end-to-end.

## Контракт между тикетами: квота и предупреждение о перелимите

Чтобы 02 (загрузка), 04 (биллинг) и 06 (UI-модалка) не разошлись, не дожидаясь друг друга (все три частично идут в одной волне):

- `QUOTA_BYTES = 7 * 1024 ** 3` — константа в `src/shared/lib/tutorFiles/storage.ts`, импортируется всеми, кто её использует. Не дублировать число `7` нигде ещё.
- `POST /api/tutor-files/files` (загрузка) возвращает `{ file, usedBytes }` — `usedBytes` пересчитан **после** записи нового файла. Клиент сам сравнивает `usedBytes > QUOTA_BYTES` (константа доступна и на клиенте через реэкспорт из общего файла, не через сеть).
- `GET /api/tutor-files/usage` возвращает `{ usedBytes, quotaBytes: QUOTA_BYTES, overageGb, priceCentsPerGbMonth }` — `priceCentsPerGbMonth` читается из `WalletSettings.storageOveragePriceCentsPerGbMonth` (0, пока админ не впишет). Это единственное место, откуда UI (тикеты 05/06) узнаёт цену — не дублировать чтение `WalletSettings` в другом месте.
- `WalletTransactionType.STORAGE_OVERAGE_DEBIT` и поле `WalletSettings.storageOveragePriceCentsPerGbMonth` создаются в тикете 01 (схема) — тикеты 03 и 04 их только используют, не объявляют заново.

## Контракт: уведомление ученика в чате о новом доступе

- `CHAT_EVENT_TYPES` (в `src/shared/lib/chat/access.ts`) пополняется значением `FILE_ACCESS_GRANTED` — добавляет тикет 03 (он же вызывает `postEventCard()` при выдаче гранта, best-effort, как `HOMEWORK_ASSIGNED`/`PERSONAL_SERVICE`).
- Ветку рендера в `src/widgets/Chat/EventCard/EventCard.tsx` для `FILE_ACCESS_GRANTED` добавляет тикет 07 — читает `message.eventPayload` с фолбэками (Prisma `Json` нетипизирован), ссылка ведёт во вкладку «Файлы» ученика.
- `eventPayload` для `FILE_ACCESS_GRANTED`: `{ itemType: 'folder' | 'file', itemName: string, teacherName: string }` — фиксируется тикетом 03 при первом использовании, тикет 07 читает по этой форме.

## Правило видимости (для тикета 01, юнит-тест обязателен)

Файл/папка видны ученику `S`, если:
1. есть явный `TutorFileGrant`/`TutorFolderGrant` на сам элемент **или** на любого предка из `ancestorIds`, **и**
2. ни у самого элемента, ни у кого из предков `restrictedToStudentId` не установлен в значение, отличное от `S` (значение `null` не ограничивает).

`ancestorIds` вычисляется один раз при создании папки (`[...parent.ancestorIds, parent.id]`) и никогда не пересчитывается — перенос папок между родителями вне рамок этой сборки.

**Важный инвариант, на котором держится `canStudentSee()` (тикет 01):** `restrictedToStudentId` выставляется ТОЛЬКО на «учебных» подпапках-листьях, создаваемых автоматически при выдаче гранта (тикет 03) — никогда на промежуточной папке с собственными вложенными подпапками. Поэтому `canStudentSee(item, ...)` проверяет `restrictedToStudentId` только у самого `item`, не обходя предков — обход предков был бы избыточен при этом инварианте. Тикет 03, создавая «учебные» подпапки, обязан сохранять этот инвариант (не вкладывать в «учебную» подпапку ещё один уровень с другим `restrictedToStudentId`). Тикет 03 для проверки видимости ФАЙЛА (у `TutorFile` своего `restrictedToStudentId` нет) обязан передавать в `item.restrictedToStudentId` значение из папки, в которой лежит файл, — не пропускать это поле как `null` по умолчанию.

Инвариант теперь не только задокументирован, но и **enforced**: `assertNotUnderRestrictedFolder(parent: {id, ancestorIds, restrictedToStudentId}): Promise<void>` в `tutorFiles/storage.ts` бросает `RestrictedAncestorError`, если у `parent` или у кого-то из его предков уже стоит `restrictedToStudentId`. **Тикеты 02 и 03 обязаны вызывать её вместе с `assertFolderDepthAllowed(parent.ancestorIds)` непосредственно перед `TutorFolder.create` для любой новой дочерней папки** — не изобретать свою проверку.

## Из тикета 01 — модель, доступ, квота

- `getFilesSessionUser()`, `canStudentSee(item, studentId, grantedIds)`, `requireOwnedFolder()`, `requireOwnedFile()`, `hasTeacherStudentLink` (реэкспорт) — в `src/shared/lib/tutorFiles/access.ts`.
- `QUOTA_BYTES` (7 ГБ), `MAX_FOLDER_DEPTH` (6), `assertFolderDepthAllowed(parentAncestorIds)`, `assertNotUnderRestrictedFolder(parent)`, `getUsedBytes(teacherId)` — в `src/shared/lib/tutorFiles/storage.ts`. Обе `assert*`-функции — вызывать вместе, перед созданием дочерней папки.
- Prisma: `TutorFolder`/`TutorFile`/`TutorFolderGrant`/`TutorFileGrant` по форме из тикета; `TutorFolder.restrictedToStudentId` — `onDelete: SetNull`, не `Cascade`. `WalletTransactionType.STORAGE_OVERAGE_DEBIT`, `WalletSettings.storageOveragePriceCentsPerGbMonth` добавлены. `CHAT_EVENT_TYPES` пополнен `FILE_ACCESS_GRANTED`.
- Self-check: `npx tsx src/shared/lib/tutorFiles/access.selfcheck.ts` и `npx tsx src/shared/lib/tutorFiles/storage.selfcheck.ts` — паттерн для новых тестов в этом проекте (assert-скрипт, не jest).

## Из тикета 02 — папки, файлы, загрузка, удаление

- `POST /api/tutor-files/folders {name, parentId?} -> {folder}` — вызывает `assertFolderDepthAllowed`+`assertNotUnderRestrictedFolder` перед созданием.
- `PATCH /api/tutor-files/folders/[id] {name} -> {folder}`.
- `DELETE /api/tutor-files/folders/[id] -> {ok:true}` — каскад через реальные Postgres FK (`onDelete: Cascade` из схемы тикета 01), проверено вручную — вложенные папки/файлы/гранты не оставляют сирот.
- `POST /api/tutor-files/files` (FormData: `file`, `folderId?`) `-> {file, usedBytes}` — загрузка через существующий S3-паттерн (`folder: 'tutor-files'`), `usedBytes` пересчитан после записи (контракт квоты для тикетов 04/06).
- `DELETE /api/tutor-files/files/[id] -> {ok:true}`.
- Все эндпоинты — 403 на чужую папку/файл (через `requireOwnedFolder`/`requireOwnedFile` тикета 01).

## Из тикета 03 — доступ, поиск, квота

- `POST /api/tutor-files/grants {itemType, itemId, studentIds[]}` — все-или-ничего по `TeacherStudent` (403), дубли `studentIds` схлопываются; карточка `FILE_ACCESS_GRANTED` уходит только тем, у кого гранта ещё не было. Личную папку ученика (`restrictedToStudentId`) расшаривать нельзя — 400.
- `GET /api/tutor-files/grants?itemType&itemId -> {students: [{id,name,avatarUrl,grantedAt}]}` — прямые гранты (для `ShareAccessModal`).
- `DELETE /api/tutor-files/grants {itemType, itemId, studentId}` — плюс `revokeOrphanedSubfolderGrants()`: снимает гранты ученика на его личные подпапки в этой ветке, если до их родителя-«сдачи» больше не дотянуться. Сами подпапки и файлы остаются у репетитора; повторная выдача восстанавливает доступ.
- `GET /api/tutor-files/search?q` — формы `LibraryFolder`/`LibraryFile` (как в библиотеке), ученик — через `loadStudentVisibility()`.
- `GET /api/tutor-files/usage` — без изменений (контракт квоты выше).

## Доревью 02–04 (облачная сессия, коммит `8a8e104`)

- **Новый** `GET /api/tutor-files/library?folderId=` → `LibraryResponse` (`src/shared/types/TutorFiles/tutorFiles.types.ts` — клиентское зеркало, импортировать в клиенте его, не `shared/lib/tutorFiles/*`). Репетитор: своя библиотека одной группой + аватары грантов + `isVip`. Ученик: только видимое по `canStudentSee()`, в корне — группы по репетитору, `canUpload` только в своей личной подпапке. Всегда отдаёт плоское `tree` для сайдбара и `teachers` (ученику — для подписи дерева).
- `src/shared/lib/tutorFiles/readModel.ts` — мапперы строк Prisma в клиентские формы (общие для `/library` и `/search`).
- `loadStudentVisibility(studentId)` в `access.ts` — единственный загрузчик видимого ученику; `fileVisibilityItem()` — как считать видимость файла по его папке.
- VIP-гейт на сервере: `isTeacherVipActive()` (как в кроне: `isVip` + не истёкший `vipExpiresAt`), `403 {error:'VIP_REQUIRED'}` на создание папки, загрузку, выдачу доступа. Чтение/удаление/отзыв — без гейта.
- `POST /files`: ученик грузит только в свою личную подпапку (`restrictedToStudentId === me` и грант ещё действует); ответ ученику — `{file}` без `usedBytes`. `DELETE /files/[id]`: ученик может удалить только свой файл из своей подпапки.
- `PATCH /folders/[id] {name?, allowStudentUpload?}` — включение флага досоздаёт подпапки всем, кто видит папку (включая унаследованный доступ через предка). Ошибки создания папки — коды `MAX_DEPTH`/`RESTRICTED_PARENT` (+`message`).
- `ensureStudentSubfolder()` / `ensureSubfoldersForGrant()` / `studentsWithAccess()` / `revokeOrphanedSubfolderGrants()` — в `storage.ts`; грант на папку создаёт подпапки во всех «сдачах» на ней и ниже.
- `QUOTA_BYTES`/`MAX_FOLDER_DEPTH`/`MAX_FILE_BYTES` — в `src/shared/lib/tutorFiles/constants.ts` (без Prisma, импортируется и клиентом); `storage.ts` их реэкспортирует.
- Крон перелимита идемпотентен в пределах календарного месяца (UTC): при наличии `STORAGE_OVERAGE_DEBIT` этого месяца репетитор пропускается.

## Из тикетов 05–07 — UI

- `src/widgets/Files/FilesShell/FilesShell.tsx` — `<FilesShell role="teacher" | "student">`, вся логика вкладки; TanStack Query ключи `['tutor-files', ...]` (любая мутация инвалидирует весь префикс).
- ~~Монтирование вкладкой в дашбордах~~ → **итерация 2 (по фидбеку пользователя): отдельная страница `/files`** (`app/files/page.tsx` → `FilesPage` → `FilesShell`), открытая папка — в `?folder=<id>` (работают «назад» и прямые ссылки). Входы: пункт «Файлы» в `ProfileSubNav` обоих дашбордов (`filesHref`), иконка `FilesHeaderIcon` в шапке (только ≥769px), ссылка карточки `FILE_ACCESS_GRANTED` → `/files`.
- Итерация 2 — дизайн по Floe: папки — `FolderShape` (силуэт «папка с уголком» через `clip-path: path()`, путь пересчитывается под размер ResizeObserver'ом, `lib.folderFrontPath/folderBackPath`), файлы — карточка «обложка сверху + белая панель», меню действий «⋮» (`CardMenu`), заголовки карточек моноширинным JetBrains Mono (`--files-mono`), секции «Папки N» / «Файлы N», пунктирная карточка «Новая папка».
- Обложки папок: `TutorFolder.cover` (миграция `20260925120000_tutor_folder_cover`) = `preset:<id>` или URL нашего S3 (`isAllowedCover`, иначе 400 `INVALID_COVER`); `null` → пастель по хэшу id. Заготовки и `resolveCover()` — `src/shared/lib/tutorFiles/covers.ts` (без Prisma). `CoverPickerModal`: пастель / арт / своя картинка через общий `uploadFile(file, 'tutor-file-covers')`.
- Полоса хранилища сверху (`StorageMeter`): занято из 7 ГБ бесплатно, сверх лимита, «в конце месяца спишется X». `GET /usage` дополнительно отдаёт `estimatedChargeCents` и `usdToBynRate`; валюта по локали — `formatMoney()`: `ru` → BYN по курсу Кошелька, остальные → USD (то же правило, что `/vip`).
- Модалки — через общий `FilesModal` (портал в `#modal_portal`, `stopPropagation`, Esc): `ShareAccessModal`, `FilePreviewModal`, `StorageOverageWarningModal`, диалоги имени/удаления.
- Предупреждение о перелимите: после загрузки `usedBytes > QUOTA_BYTES && usedBytes - file.sizeBytes <= QUOTA_BYTES` → один раз, цена из `GET /usage`; при `0` — текст без суммы.
- i18n: namespace `files` (все 4 локали), `dashboard.tabFiles`, `chat.eventCard.fileAccess*`. Иконки — `src/widgets/Files/icons.tsx` (реэкспорт lucide), в чате — `ChatFilesIcon`.

## Из тикета 04 — биллинг перелимита

- `chargeStorageOverage(teacherId, overageGb, priceCentsPerGb, at): Promise<ChargeResult>` в `src/shared/lib/wallet/wallet.ts` — атомарное списание, zero-floor при нехватке (не бросает, списывает остаток до нуля).
- `getWalletPricingSettings`/`setWalletPricingSettings` расширены полем `storageOveragePriceCentsPerGbMonth`.
- `GET /api/cron/storage-overage-billing` — `Authorization: Bearer $CRON_SECRET`, 401 без него.
- `vercel.json` → `crons` пополнен записью `"0 3 1 * *"` для этого пути.
- `WalletSettingsCard` (AdminPage) — новое поле «Плата за перелимит хранилища файлов, ¢/ГБ в мес.».
