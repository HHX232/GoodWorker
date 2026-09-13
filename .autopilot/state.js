window.STATE =
{
  "slug": "tutor-catalog-prototypes",
  "title": "Каталог репетиторов — три дизайн-прототипа (продуктовый / PDF→Тест / гибрид)",
  "mode": "semi",
  "depth": "normal",
  "tier": "T1",
  "briefFile": "2026-08-19-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-08-19T21:19:38+03:00",
  "updatedAt": "2026-08-19T21:31:10+03:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done",    "startedAt": "2026-08-19T21:19:38+03:00", "finishedAt": "2026-08-19T21:21:00+03:00" },
    { "id": "manifest",  "status": "done",    "startedAt": "2026-08-19T21:21:00+03:00", "finishedAt": "2026-08-19T21:23:25+03:00", "note": "18 требований" },
    { "id": "briefing",  "status": "skipped", "startedAt": "2026-08-19T21:23:25+03:00", "finishedAt": "2026-08-19T21:23:25+03:00", "note": "вопросов не потребовалось — форки закрыты ASSUMPTION в манифесте" },
    { "id": "spec",      "status": "done",    "startedAt": "2026-08-19T21:23:25+03:00", "finishedAt": "2026-08-19T21:31:10+03:00", "note": "G2: 8 находок закрыты" },
    { "id": "plan",      "status": "done",    "startedAt": "2026-08-19T21:31:10+03:00", "finishedAt": "2026-08-19T21:38:14+03:00", "note": "3 таска, 1 волна (независимые файлы), ярус T1" },
    { "id": "build",     "status": "active",  "startedAt": "2026-08-19T21:38:14+03:00" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 31, "done": 7, "inTicket": 24, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Каталог A — продуктовый (GoodWorker) — выбран итоговым направлением", "requirements": ["R01","R02","R03","R03.1i","R06","R06.1","R07","R08","R08.1","R09","R09.1i","R10","R10.1i","R11","R12","R12.1","R09.1","R.growth","R17i","R18i","G01","G02","G03","G04","G05","G06","G07"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/catalog-a-goodworker.html"], "status": "in-progress", "startedAt": "2026-08-19T21:40:47+03:00", "retries": 0, "repairs": 2, "commit": "820b7e4", "files": ["ForNewDesign/prototypes/catalog-a-goodworker.html"], "concerns": ["дозапрос G01-G07 после ревью пользователем — реальная палитра GW, только раскладка фильтров 1, язык на карточке, hover-бейдж, меню-троеточие, теги как в C", "второй дозапрос — мёртвая разметка/badge-hover уточнён/комментарии-ID почищены", "третий дозапрос G08-G13 в процессе — 5 цветовых гамм, тёмная кнопка+белый текст, тултип на бейдже, чип +N переоформлен, язык отделён от тегов, звёздный рейтинг"] },
    { "id": "02", "title": "Каталог B — редакторский (PDF → Тест) — построен, не выбран направлением", "requirements": ["R01","R02","R04","R06","R06.1","R07","R08","R08.1","R09","R09.1i","R10","R10.1i","R11","R12","R12.1","R09.1","R.growth","R17i","R18i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/catalog-b-pdftotest.html"], "status": "done", "startedAt": "2026-08-19T21:40:47+03:00", "finishedAt": "2026-08-19T22:22:08+03:00", "retries": 0, "repairs": 0, "commit": "756a064", "files": ["ForNewDesign/prototypes/catalog-b-pdftotest.html"], "concerns": ["--fs-hero переименован в --fs-h1 (обоснованно, но формально отступление от «дословно»)", "разметка карточки повторена 6 раз без JS-шаблона — ожидаемо при конвенции «без сборки»", "не выбран пользователем итоговым направлением (см. G01), доработка остановлена"] },
    { "id": "03", "title": "Каталог C — гибрид + витрина в index.html", "requirements": ["R01","R02","R05","R06","R06.1","R07","R08","R08.1","R09","R09.1i","R10","R10.1i","R11","R12","R12.1","R09.1","R.growth","R17i","R18i","R16i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/catalog-c-hybrid.html","ForNewDesign/prototypes/index.html"], "status": "in-progress", "startedAt": "2026-08-19T21:40:47+03:00", "retries": 0 }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "found": 8, "fixed": 8, "deferred": 0 },
  "blind": null
}
