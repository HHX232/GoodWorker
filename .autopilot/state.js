window.STATE =
{
  "slug": "pdf-landing-v3-lab",
  "title": "V3-лендинг: панель управления, hero-анимации (blueprint), цветовые гаммы, вариации шагов, лимиты+VIP",
  "mode": "semi",
  "depth": "normal",
  "tier": "T2",
  "briefFile": "2026-08-13-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-08-13T00:56:59+03:00",
  "updatedAt": "2026-08-13T03:35:00+03:00",
  "finishedAt": null,
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-13T00:56:59+03:00", "finishedAt": "2026-08-13T01:00:00+03:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-13T01:00:00+03:00", "finishedAt": "2026-08-13T01:00:00+03:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-13T01:00:00+03:00", "finishedAt": "2026-08-13T01:05:00+03:00", "note": "3 вопроса" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-13T01:05:00+03:00", "finishedAt": "2026-08-13T01:12:00+03:00", "note": "G2: 4 находки закрыты" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-13T01:12:00+03:00", "finishedAt": "2026-08-13T01:20:00+03:00", "note": "4 таска, последовательно (один файл), T2" },
    { "id": "build",     "status": "active", "startedAt": "2026-08-13T01:20:00+03:00", "note": "Т01 дочинка после обрыва по лимиту сессии" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": {
    "total": 18, "done": 0, "inTicket": 18, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Фундамент лаборатории: панель, токены, гаммы, лимиты/VIP", "requirements": ["R01","R02","R02.1","R02.2","R08","R08.1","R09","R10","R11","R12","R14i","R15i","R15.1","R15.2","R16i","R17i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "in-progress", "retries": 0, "startedAt": "2026-08-13T01:20:00+03:00" },
    { "id": "02", "title": "Blueprint-hero H1 и H2 (изометрия, тёмная подложка)", "requirements": ["R04","R05","R04.1","R03","R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "pending", "retries": 0 },
    { "id": "03", "title": "Hero H3 (вопросы из бланка) + детализация бланка H4", "requirements": ["R06","R07"], "blockedBy": ["02"], "wave": 3, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "pending", "retries": 0 },
    { "id": "04", "title": "Вариации «Три шага» (S2, S3)", "requirements": ["R09"], "blockedBy": ["03"], "wave": 4, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "pending", "retries": 0 }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "found": 4, "fixed": 4, "deferred": 0 },
  "blind": null
}
