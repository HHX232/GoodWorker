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
  "updatedAt": "2026-08-12T22:53:00+03:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-12T22:37:41+03:00", "finishedAt": "2026-08-12T22:40:18+03:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-12T22:40:18+03:00", "finishedAt": "2026-08-12T22:41:30+03:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-12T22:41:30+03:00", "finishedAt": "2026-08-12T22:44:00+03:00", "note": "3 вопроса" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-12T22:44:00+03:00", "finishedAt": "2026-08-12T22:49:00+03:00", "note": "G2: 2 полу-покрытия исправлены" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-12T22:49:00+03:00", "finishedAt": "2026-08-12T22:53:00+03:00", "note": "4 таска, 2 волны, ярус T2" },
    { "id": "build",     "status": "active", "startedAt": "2026-08-12T22:53:00+03:00" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 17, "done": 0, "inTicket": 17, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Фундамент: переключатель, reveal-ядро, index", "requirements": ["R10", "R10.1", "R11", "R11.1", "R14i", "R15i", "R16i", "R03.2"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/shared/", "ForNewDesign/prototypes/index.html"], "status": "in-progress", "startedAt": "2026-08-12T22:54:00+03:00", "retries": 0 },
    { "id": "02", "title": "Вариант A — Swiss / Kinetic Type", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-a-swiss.html"], "status": "pending", "retries": 0 },
    { "id": "03", "title": "Вариант B — Terminal / Blueprint", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-b-terminal.html"], "status": "pending", "retries": 0 },
    { "id": "04", "title": "Вариант C — Cinematic / Gallery", "requirements": ["R01", "R02", "R03", "R03.1", "R04", "R05", "R06", "R07", "R08", "R09", "R12", "R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/variant-c-cinematic.html"], "status": "pending", "retries": 0 }
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
