# 06 — Модалка нехватки баланса на фронтенде (уточнение R17)

**Требования:** R17
**Blocked by:** 02, 03, 04
**Зона:** `src/widgets/Wallet/InsufficientBalanceModal/`, `src/widgets/VideoRoom/CallWhiteboard/FormulaKeyboard.tsx`, `src/widgets/VideoRoom/CallWhiteboard/FormulaPhotoModal.tsx`, `src/widgets/Calendar/Modals/LessonPlanModal/`, `src/widgets/Calendar/Modals/CalendarCreateModal/`, `src/widgets/Tests/PdfImportModal/`, `app/info-pdf-to-test/page.tsx`, `messages/en.json`, `messages/hi.json`, `messages/ru.json`, `messages/zh.json`
**Волна:** 3
**Status:** ready

## Что должно заработать

Пользователь во время сборки прямо уточнил: при нехватке баланса на AI-вызов фронтенд
должен показать понятную модалку («баланс кончился»), а не общую ошибку. Backend-контракт
уже есть (тикеты 02/03) — HTTP 402, тело `{error:"INSUFFICIENT_BALANCE", message,
neededCents, availableCents}`. Не хватает только фронтенд-перехвата в шести точках, откуда
сегодня вызывается любой из 7 платных эндпоинтов.

VIP-статус при нулевом балансе **не меняется** — это уже верно по дизайну (баланс и
`isVip`/`vipExpiresAt` не связаны), в этом тикете ничего с VIP не трогать.

## Из брифа, дословно (новое сообщение во время сборки)

> «если баланс обнулился, то вип у нас остается статус, то есть ограничения на участников
> и тому подобное снимаются как для вип сейчас, просто при попытке юзануть вип функцию AI
> выдаем модалку что баланс кончился»

## Разделы спецификации

Решения §«Модалка нехватки баланса на фронтенде».

## Критерии приёмки

- [ ] `src/widgets/Wallet/InsufficientBalanceModal/InsufficientBalanceModal.tsx` (+.module.scss) — принимает `neededCents`/`availableCents`, показывает разницу в долларах человеко-читаемо, кнопка-ссылка на `/wallet` (без авто-редиректа), можно закрыть без перехода
- [ ] `FormulaKeyboard.tsx` — перехватывает 402/`INSUFFICIENT_BALANCE` от `whiteboard/formula-ai`, открывает модалку вместо текущей обработки ошибки
- [ ] `FormulaPhotoModal.tsx` — то же для `whiteboard/formula-photo`
- [ ] `LessonPlanModal` (и точка вызова из `CalendarCreateModal`, если ошибка всплывает туда) — то же для `teacher/lesson-plan` и `teacher/lesson-plan/revise`
- [ ] `PdfImportModal` — то же для `tests/import-pdf`
- [ ] `app/info-pdf-to-test/page.tsx` — то же для обоих путей `pdf-to-test` и `pdf-to-test/photos`
- [ ] Существующая обработка прочих ошибок (не 402) в каждой из шести точек не изменилась — модалка показывается только на `INSUFFICIENT_BALANCE`
- [ ] Namespace `wallet` в `messages/{en,hi,ru,zh}.json` дополнен строками модалки (переиспользовать, не дублировать существующие ключи тикета 04, если подходят)
- [ ] Живая проверка в браузере (`npm run dev`, сид-логин с нулевым балансом): попытка сгенерировать формулу/план урока/тест из PDF при нулевом балансе показывает модалку, а не падает молча и не показывает голый JSON ошибки
- [ ] По возвращении — дописать в `interfaces.md`, если сигнатура компонента уточнилась
