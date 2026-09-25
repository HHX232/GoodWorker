# 03 — API: доступ, «учебные» подпапки, поиск, уведомление в чат

**Требования:** R03, R03.1, R04i, R05i, R06i, R06i.1, G03, G03.1, G03.2, R03i.3
**Blocked by:** 01
**Зона:** `app/api/tutor-files/grants/`, `app/api/tutor-files/search/`, `app/api/tutor-files/usage/`, `src/shared/lib/chat/access.ts` (только добавление значения в `CHAT_EVENT_TYPES`, уже создано тикетом 01 — здесь только вызов `postEventCard`)
**Волна:** 2
**Status:** ready

## Что должно заработать

Репетитор выдаёт и отзывает доступ ученикам (одному или нескольким сразу, на папку или на файл), ищет по своей библиотеке, а ученик — по своей granted-части. Папка с `allowStudentUpload=true` при выдаче гранта автоматически заводит ученику личную подпапку.

- `POST /api/tutor-files/grants` — `{itemType: 'folder'|'file', itemId, studentIds: string[]}`. Для каждого `studentId`: проверка `hasTeacherStudentLink`, создание `TutorFolderGrant`/`TutorFileGrant`. Если `itemType==='folder'` и у папки `allowStudentUpload===true` — транзакционно создаёт (если ещё нет) дочернюю `TutorFolder` с `restrictedToStudentId=studentId`, именем ученика, и собственный `TutorFolderGrant` на неё для этого же ученика (см. G03 в спецификации). После успешной выдачи — `postEventCard({teacherId, studentId, eventType: 'FILE_ACCESS_GRANTED', payload: {itemType, itemName, teacherName}})` best-effort (`.catch`, не блокирует ответ) — форма `payload` зафиксирована в `interfaces.md`.
- `DELETE /api/tutor-files/grants` — `{itemType, itemId, studentId}` — отзыв одного гранта.
- `GET /api/tutor-files/search?q=...` — для репетитора: по всей его библиотеке (`teacherId`, `name` ILIKE); для ученика: только среди того, что видно по `canStudentSee()`.
- `GET /api/tutor-files/usage` — контракт зафиксирован в `interfaces.md` («Контракт между тикетами: квота») — `{usedBytes, quotaBytes, overageGb, priceCentsPerGbMonth}`.

Загрузка ученика в «учебную» подпапку — тем же эндпоинтом `POST /api/tutor-files/files` из тикета 02, но с проверкой: ученик может грузить только в папку, где `restrictedToStudentId === session.user.id` (или где-то среди предков стоит его личная подпапка — фактически загрузка идёт прямо в неё). Если `getFilesSessionUser()` вернул `STUDENT` и целевая папка не его личная — 403.

## Из брифа, дословно

> «добавление доступа ученикам и тому подобное»

## Разделы спецификации

Истории 11–20, 22–24 (R03, R03.1, R04i, R05i, R06i, R06i.1, G03, G03.1, G03.2, R03i.3). Решения §Доступ, §UI (уведомление в чате).

## Критерии приёмки

- [ ] Выдача доступа нескольким ученикам за один запрос создаёт гранты всем перечисленным
- [ ] Выдача доступа на папку с `allowStudentUpload=true` создаёт личную подпапку ученика, не трогает подпапки других учеников
- [ ] Ученик B не может увидеть (через `GET`-список/поиск) личную подпапку ученика A в той же родительской папке
- [ ] Отзыв доступа убирает элемент из выдачи ученику при следующем запросе
- [ ] Попытка дать доступ ученику, не связанному с репетитором через `TeacherStudent` — 403
- [ ] Поиск ученика не возвращает ничего за пределами его granted-подмножества
- [ ] После выдачи доступа в чате репетитор-ученик появляется сообщение с `eventType: 'FILE_ACCESS_GRANTED'` (проверить в БД — рендер UI делает тикет 07)
