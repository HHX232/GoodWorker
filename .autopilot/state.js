window.STATE =
{
  "slug": "tutor-files-reupload-edit",
  "title": "Перезалив отредактированного PDF в директорию + оценка редактирования docx",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-09-26-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-09-26T00:52:21+03:00",
  "updatedAt": "2026-09-27T17:50:00+03:00",
  "finishedAt": "2026-09-27T17:50:00+03:00",
  "stages": [
    { "id": "preflight", "status": "done",    "startedAt": "2026-09-26T00:52:21+03:00", "finishedAt": "2026-09-26T00:53:00+03:00" },
    { "id": "manifest",  "status": "done",    "startedAt": "2026-09-26T00:53:00+03:00", "finishedAt": "2026-09-26T00:54:00+03:00", "note": "7 требований" },
    { "id": "briefing",  "status": "done",    "startedAt": "2026-09-26T00:54:00+03:00", "finishedAt": "2026-09-26T00:56:00+03:00", "note": "1 вопрос — docx-редактор" },
    { "id": "spec",      "status": "done",    "startedAt": "2026-09-26T00:56:00+03:00", "finishedAt": "2026-09-27T00:10:00+03:00" },
    { "id": "plan",      "status": "skipped", "note": "ярус T0 — без разбивки на таски" },
    { "id": "build",     "status": "done",    "startedAt": "2026-09-27T00:10:00+03:00", "finishedAt": "2026-09-27T17:45:00+03:00" },
    { "id": "review",    "status": "done",    "startedAt": "2026-09-27T17:20:00+03:00", "finishedAt": "2026-09-27T17:45:00+03:00", "note": "T0 — все 3 оси инлайн" },
    { "id": "final",     "status": "done",    "startedAt": "2026-09-27T17:45:00+03:00", "finishedAt": "2026-09-27T17:50:00+03:00" }
  ],
  "requirements": { "total": 7, "done": 6, "inTicket": 0, "inSpec": 0, "placeholder": 0, "deferred": 1, "dropped": 0 },
  "coverage": { "found": 0, "fixed": 0, "deferred": 0, "notes": "G2 — самопроверка орк-ром (T0, независимый субагент отклонён пользователем): брифу соответствуют все 4 пункта, лишнего не найдено" },
  "tickets": [],
  "singlePass": {
    "startedAt": "2026-09-27T00:10:00+03:00",
    "finishedAt": "2026-09-27T17:45:00+03:00",
    "files": [
      "src/widgets/Files/ReviewModal/ReviewModal.tsx",
      "src/widgets/Files/ReviewModal/ReviewModal.module.scss",
      "src/widgets/Files/FilesShell/FilesShell.tsx",
      "package.json", "package-lock.json",
      "messages/en.json", "messages/ru.json", "messages/hi.json", "messages/zh.json"
    ],
    "tests": { "passed": 0, "failed": 0 },
    "commit": "9875516"
  },
  "tests": { "passed": 0, "failed": 0 },
  "debt": {
    "placeholders": [],
    "assumptions": [
      "Кнопка впечатывает только новые (несохранённые) мазки текущей сессии, не пометки, сохранённые в прошлой проверке — во избежание тайнта canvas без гарантии CORS у бакета (spec §2)",
      "Не распространено на изображения (только PDF) — брифу соответствует, но A01 в spec «Вне рамок» описывает дешёвое расширение по запросу"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "blind": { "checked": 6, "agreed": 6, "drift": 0, "notes": "Слепая сверка орк-ром (T0, без отдельного субагента — пользователь отклонил подобный запуск на G2): все 4 пункта брифа покрыты кодом 1:1, включая «одной кнопкой», «рядом с оригиналом», «не скачивать»." }
}
