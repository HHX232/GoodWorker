# Что уже построено

Ярус T0 — один контекст, без нарезки на таски. Границы — из `spec.md` → «Границы и швы».

## Правила проекта

- Стек: Next.js (App Router) + Prisma + PostgreSQL, SCSS-модули, `next-intl`, TanStack Query, `lucide-react`.
- Тестового раннера нет — верификация: `npm run build` (типы) + смоук в браузере (`npm run dev`).
- i18n: namespace `files`, добавлять ключи одновременно во все 4 локали (`en`, `ru`, `hi`, `zh`).
- Недостающая зависимость обычно не ставится (возвращаем `BLOCKED`) — здесь исключение: `pdf-lib` добавлена лениво (`import('pdf-lib')`), по прецеденту `docx-preview`/SheetJS из итерации 4 tutor-files.

## Границы

- `AnnotatedPages` — без изменений, `exportStrokes()`/`hasChanges()` уже публичны, переиспользуются как есть.
- `ReviewModal` — новая функция сборки исправленного PDF (байты оригинала + `exportStrokes()` → `pdf-lib`), новый проп `onReupload: (file: File) => Promise<boolean>`.
- `FilesShell` — передаёт `onReupload={f => uploadFiles([f])}` в `<ReviewModal>` (переиспользует существующую `uploadFiles`, никакой новой логики квоты/VIP/тостов).

## Построено (T0, один проход)

- `uploadFiles()` в `FilesShell.tsx` теперь возвращает `Promise<boolean>` (раньше `void`) — успела ли загрузка целиком. Существующие вызовы (drag&drop, инпут-загрузка) результат игнорируют, поведение не изменилось; новый вызов из `onReupload` использует его, чтобы не показать «успех» поверх уже показанного тоста об ошибке квоты/VIP.
- `ReviewModal.tsx`: кнопка «Загрузить в директорию» в тулбаре — видна только для `viewer === 'pdf'` и только когда есть новые (несохранённые) мазки текущей сессии (`hasMarks`, стейт, обновляемый в `onChange`, а не чтением `pagesRef.current` во время рендера — react-hooks/refs ругается на второе). `uploadCorrected()`: `exportStrokes()` (уже существовал) → `fetch` тех же байт PDF, что и `/content` → `pdf-lib` (`PDFDocument.load` + `embedPng` + `drawImage` на всю страницу, по одной на каждую отмеченную страницу) → `pdfDoc.save()` → `new File(...)` → `onReupload`.
- Новая зависимость: `pdf-lib` (^1.17.1), лениво через `import('pdf-lib')` внутри `uploadCorrected()` — не в общем бандле.
- i18n: `files.reuploadButton`/`reuploadSuffix`/`reuploadDone` в `messages/{en,ru,hi,zh}.json`.
- Проверено: `tsc --noEmit` и `eslint` по всему проекту — чисто; `npm run dev` + логин `teacher@seed.dev` + `GET /files` — бандл собирается и рендерится без ошибок в консоли сервера. Ручной клик «нарисовать мазок → нажать кнопку → увидеть второй файл» вживую в браузере не прогонялся (нужен реальный PDF на проверке и рисование пером) — стоит один раз проверить руками.
