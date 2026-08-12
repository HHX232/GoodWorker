window.STATE =
{
  "slug": "pdf-test-landing",
  "title": "Лендинг PDF→Test — несколько принципиально разных вариантов с переключением",
  "mode": "semi",
  "depth": "normal",
  "tier": "T2",
  "briefFile": "2026-08-12-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-08-12T22:37:41+03:00",
  "updatedAt": "2026-08-12T22:58:30+03:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-12T22:37:41+03:00", "finishedAt": "2026-08-12T22:40:18+03:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-12T22:40:18+03:00", "finishedAt": "2026-08-12T22:41:30+03:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-12T22:41:30+03:00", "finishedAt": "2026-08-12T22:44:00+03:00", "note": "3 вопроса" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-12T22:44:00+03:00", "finishedAt": "2026-08-12T22:49:00+03:00", "note": "G2: 2 полу-покрытия исправлены" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-12T22:49:00+03:00", "finishedAt": "2026-08-12T22:53:00+03:00", "note": "4 таска, 2 волны, ярус T2" },
    { "id": "build",     "status": "active", "startedAt": "2026-08-12T22:53:00+03:00", "note": "1 из 4 готов, волна 2 — 3 параллельно" },
    { "id": "review",    "status": "active", "startedAt": "2026-08-12T22:58:30+03:00", "note": "01 проверен инлайн" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 17, "done": 3, "inTicket": 14, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Фундамент: переключатель, reveal-ядро, index", "requirements": ["R10", "R10.1", "R11", "R11.1", "R14i", "R15i", "R16i", "R03.2"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/shared/", "ForNewDesign/prototypes/index.html"], "status": "done", "startedAt": "2026-08-12T22:54:00+03:00", "finishedAt": "2026-08-12T22:58:30+03:00", "retries": 0, "repairs": 0, "files": ["ForNewDesign/prototypes/shared/switcher.js", "ForNewDesign/prototypes/shared/reveal-core.js", "ForNewDesign/prototypes/index.html"], "tests": { "passed": 0, "failed": 0 }, "commit": "965345f", "concerns": ["switcher.js: мёртвый тернар 'auto':'auto' в restoreScroll (поведение верное)"] },
    { "id": "02", "title": "Вариант A — Swiss / Kinetic Type", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-a-swiss.html"], "status": "done", "startedAt": "2026-08-12T22:58:30+03:00", "finishedAt": "2026-08-12T23:10:00+03:00", "retries": 0, "repairs": 0, "files": ["ForNewDesign/prototypes/variant-a-swiss.html"], "tests": { "passed": 0, "failed": 0 }, "commit": "pending02", "concerns": ["скраб-hero активен ≥900px (деградация R01.1)"] },
    { "id": "03", "title": "Вариант B — Terminal / Blueprint", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-b-terminal.html"], "status": "done", "startedAt": "2026-08-12T22:58:30+03:00", "finishedAt": "2026-08-12T23:12:00+03:00", "retries": 0, "repairs": 1, "files": ["ForNewDesign/prototypes/variant-b-terminal.html"], "tests": { "passed": 0, "failed": 0 }, "commit": "pending03", "concerns": ["--ink-2 #8b8b85 ради контраста ≥4.5:1", "заголовок типов без decode ради дословности"] },
    { "id": "04", "title": "Вариант C — Cinematic / Gallery", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-c-cinematic.html"], "status": "done", "startedAt": "2026-08-12T22:58:30+03:00", "finishedAt": "2026-08-12T23:10:00+03:00", "retries": 0, "repairs": 0, "files": ["ForNewDesign/prototypes/variant-c-cinematic.html"], "tests": { "passed": 0, "failed": 0 }, "commit": "pending04", "concerns": [] }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": {
    "placeholders": [
      "Hero-видео процесса — сейчас анимированный плейсхолдер",
      "Демо-персона в «Профиль ошибок» — помечена «пример»",
      "Целевой URL CTA «Загрузить PDF» — подтвердить"
    ],
    "assumptions": [],
    "emptyEnv": ["KIE_API_KEY (нужен позже для генерации hero-видео)"]
  },
  "additions": [],
  "coverage": { "found": 2, "fixed": 2, "deferred": 0 },
  "blind": null
}
