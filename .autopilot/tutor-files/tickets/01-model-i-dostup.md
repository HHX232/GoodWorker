# 01 — Модель данных, доступ, квота

**Требования:** R02, R02i, R05i, G04, R03i.3 (частично — тип события), G02 (частично — схема), G03 (частично — схема)
**Blocked by:** —
**Зона:** `prisma/schema.prisma`, `prisma/migrations/`, `src/shared/lib/tutorFiles/access.ts`, `src/shared/lib/tutorFiles/storage.ts`
**Волна:** 1
**Status:** done

## Что должно заработать

Фундамент, с которого стартуют все остальные таски: схема данных для файлов/папок репетитора, правила доступа, база для биллинга перелимита.

Prisma-модели (по образцу `TeacherStudent`/`Conversation` — `String @id @default(uuid())`, `onDelete: Cascade`, camelCase FK):

- `TutorFolder`: `id, teacherId, parentId? -> TutorFolder (self-relation), name, allowStudentUpload Boolean @default(false), restrictedToStudentId? -> Student, ancestorIds String[], createdAt, updatedAt`.
- `TutorFile`: `id, teacherId, folderId? -> TutorFolder (null = корень), name, key, url, sizeBytes, mimeType, uploadedByRole (переиспользовать enum Role), uploadedById, createdAt`.
- `TutorFolderGrant`: `folderId, studentId, grantedAt` — `@@id([folderId, studentId])`, `onDelete: Cascade` с обеих сторон.
- `TutorFileGrant`: `fileId, studentId, grantedAt` — `@@id([fileId, studentId])`, `onDelete: Cascade`.
- `WalletTransactionType` — добавить значение `STORAGE_OVERAGE_DEBIT`.
- `WalletSettings` — добавить поле `storageOveragePriceCentsPerGbMonth Int @default(0)`.
- `CHAT_EVENT_TYPES` (в `src/shared/lib/chat/access.ts`) — добавить `FILE_ACCESS_GRANTED`.

`ancestorIds` вычисляется один раз при создании папки как `[...parent.ancestorIds, parent.id]` (для корневой папки — `[]`). Никогда не пересчитывается: перенос папок между родителями не строим (см. «Вне рамок» спецификации).

`src/shared/lib/tutorFiles/access.ts` — по образцу `src/shared/lib/chat/access.ts`:
- `getFilesSessionUser()` — тот же ADMIN→TEACHER маппинг, что в `getChatSessionUser()`.
- `hasTeacherStudentLink` — реэкспорт из `chat/access.ts` (не дублировать).
- `canStudentSee(item: {ancestorIds: string[], id: string, restrictedToStudentId: string | null}, studentId: string, grants: Set<string>): boolean` — правило: (явный грант на сам элемент или на любого предка из `ancestorIds`) И (ни у элемента, ни у предка `restrictedToStudentId` не указывает на другого ученика). Точная формулировка — в `interfaces.md`, раздел «Правило видимости».
- `requireOwnedFolder(folderId, teacherId)` / `requireOwnedFile(fileId, teacherId)` — гварды по образцу `requireOwnedConversation`, возвращают `{folder} | {response: NextResponse}`.

`src/shared/lib/tutorFiles/storage.ts`:
- `QUOTA_BYTES = 7 * 1024 ** 3` — единственное место, где определено число 7 ГБ.
- `getUsedBytes(teacherId): Promise<number>` — `SUM(sizeBytes) WHERE teacherId`, обычный агрегат.
- `MAX_FOLDER_DEPTH = 6`.

## Из брифа, дословно

> «сможем ли мы сделать подобное очень красивое решение для репетиторов по хранению файлов + вложенности файлов + добавление доступа ученикам»

## Разделы спецификации

Решения §Модель данных, §Доступ. Границы и швы (вся таблица). `interfaces.md` целиком.

## Критерии приёмки

- [ ] `npx prisma generate` и dev-миграция проходят без ошибок на существующей БД (новые модели, новое значение enum, новое поле не ломают существующие данные)
- [ ] `canStudentSee()` — юнит-тест: грант на файл напрямую; грант на папку-предка (в т.ч. через несколько уровней); отсутствие гранта; «учебная» подпапка ученика A невидима ученику B, у которого есть грант на родительскую папку
- [ ] Создание 7-го уровня вложенности (после 6 существующих) отклоняется функцией/проверкой на уровне `storage.ts`, ошибка понятная
- [ ] `getUsedBytes` корректно суммирует по нескольким файлам разных папок одного репетитора и не учитывает файлы другого репетитора
