window.STATE =
{
  "slug": "wallet-prototypes",
  "title": "Страница «Кошелёк» — 3 дизайн-варианта",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-09-24-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-09-24T21:15:04+03:00",
  "updatedAt": "2026-09-24T21:35:14+03:00",
  "finishedAt": null,
  "tier": "T1",
  "stages": [
    { "id": "preflight", "status": "done",   "startedAt": "2026-09-24T21:15:04+03:00", "finishedAt": "2026-09-24T21:16:00+03:00" },
    { "id": "manifest",  "status": "done",   "startedAt": "2026-09-24T21:16:00+03:00", "finishedAt": "2026-09-24T21:17:30+03:00", "note": "14 требований (10 явных + 4 подразумеваемых)" },
    { "id": "briefing",  "status": "done",   "startedAt": "2026-09-24T21:17:30+03:00", "finishedAt": "2026-09-24T21:17:30+03:00", "note": "вопросов не потребовалось — все развилки решены по прецеденту (catalog-a/b/c, footer-variants) и записаны как ASSUMPTION" },
    { "id": "spec",      "status": "done",   "startedAt": "2026-09-24T21:17:30+03:00", "finishedAt": "2026-09-24T21:21:30+03:00", "note": "G2: 3 находки закрыты (карта-баланс, анкер на главную, явная отвязка Send/Request)" },
    { "id": "plan",      "status": "done",   "startedAt": "2026-09-24T21:21:30+03:00", "finishedAt": "2026-09-24T21:23:51+03:00", "note": "3 таска, ярус T1, волна 1 (все параллельно, независимые файлы)" },
    { "id": "build",     "status": "active", "startedAt": "2026-09-24T21:23:51+03:00" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": { "total": 14, "done": 0, "inTicket": 14, "inSpec": 0, "placeholder": 0, "deferred": 0, "dropped": 0 },
  "tickets": [
    { "id": "01", "title": "Вариант A — 3D / Дашборд", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.1","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-a-3d.html"], "status": "done", "startedAt": "2026-09-24T21:24:43+03:00", "finishedAt": "2026-09-24T21:34:47+03:00", "retries": 0, "repairs": 2, "files": ["ForNewDesign/prototypes/wallet-a-3d.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": [] },
    { "id": "02", "title": "Вариант B — Ч/Б / Классика", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.2","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-b-mono.html"], "status": "done", "startedAt": "2026-09-24T21:24:43+03:00", "finishedAt": "2026-09-24T21:35:14+03:00", "retries": 0, "repairs": 2, "files": ["ForNewDesign/prototypes/wallet-b-mono.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": [] },
    { "id": "03", "title": "Вариант C — Гроссбух / Редакционный", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.3","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-c-ledger.html"], "status": "review", "startedAt": "2026-09-24T21:24:43+03:00", "retries": 0, "files": ["ForNewDesign/prototypes/wallet-c-ledger.html"] }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": [
    "3D в варианте A — CSS-глубина (тени/градиенты/перспектива), не WebGL/three.js",
    "прототипы — статический HTML в ForNewDesign/prototypes/, не Next.js-компоненты",
    "данные (баланс/операции/предложения) — моковые, общие для всех 3 вариантов, на основе реальных продуктов GoodWorker (VIP, Pro-план, PDF→Тест, личные услуги)"
  ], "emptyEnv": [], "craftNotes": [] },
  "additions": [],
  "coverage": { "found": 3, "fixed": 3, "deferred": 0, "notes": "G2: баланс-как-карта (Visa-мотив) и явная отвязка Send/Request от офферов дописаны в вариант A; анкер «как щас главная» уточнён до конкретных токенов LandingPage.module.scss" },
  "blind": null
}
