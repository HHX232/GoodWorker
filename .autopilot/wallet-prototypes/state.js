window.STATE =
{
  "slug": "wallet-prototypes",
  "title": "Страница «Кошелёк» — 3 дизайн-варианта",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-09-24-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-09-24T21:15:04+03:00",
  "updatedAt": "2026-09-24T22:02:56+03:00",
  "finishedAt": "2026-09-24T22:02:56+03:00",
  "tier": "T1",
  "stages": [
    { "id": "preflight", "status": "done",   "startedAt": "2026-09-24T21:15:04+03:00", "finishedAt": "2026-09-24T21:16:00+03:00" },
    { "id": "manifest",  "status": "done",   "startedAt": "2026-09-24T21:16:00+03:00", "finishedAt": "2026-09-24T21:17:30+03:00", "note": "14 требований (10 явных + 4 подразумеваемых)" },
    { "id": "briefing",  "status": "done",   "startedAt": "2026-09-24T21:17:30+03:00", "finishedAt": "2026-09-24T21:17:30+03:00", "note": "вопросов не потребовалось — все развилки решены по прецеденту (catalog-a/b/c, footer-variants) и записаны как ASSUMPTION" },
    { "id": "spec",      "status": "done",   "startedAt": "2026-09-24T21:17:30+03:00", "finishedAt": "2026-09-24T21:21:30+03:00", "note": "G2: 3 находки закрыты (карта-баланс, анкер на главную, явная отвязка Send/Request)" },
    { "id": "plan",      "status": "done",   "startedAt": "2026-09-24T21:21:30+03:00", "finishedAt": "2026-09-24T21:23:51+03:00", "note": "3 таска, ярус T1, волна 1 (все параллельно, независимые файлы)" },
    { "id": "build",     "status": "done",   "startedAt": "2026-09-24T21:23:51+03:00", "finishedAt": "2026-09-24T22:02:56+03:00", "note": "4 из 4 тасков готовы (T04 — итерация 2 по фидбеку)" },
    { "id": "review",    "status": "done",   "startedAt": "2026-09-24T21:29:12+03:00", "finishedAt": "2026-09-24T22:02:56+03:00", "note": "T01-03: manifest+spec/craft + кросс-файловая сверка, 3 дозапроса. T04: точечная проверка орк-ром (grep на ключевой контент/пагинацию/отсутствие карты) — правки в одном известном файле, малый риск" },
    { "id": "final",     "status": "done",   "startedAt": "2026-09-24T21:36:30+03:00", "finishedAt": "2026-09-24T22:02:56+03:00", "note": "G4 первого прохода — чисто (21:38). T04 (итерация 2) — точечная проверка орк-ром, повторный полный слепой прогон не запускался (малый локальный фидбек-фикс, не новый бриф)" }
  ],
  "requirements": { "total": 14, "done": 14, "inTicket": 0, "inSpec": 0, "placeholder": 0, "deferred": 0, "dropped": 0 },
  "tickets": [
    { "id": "01", "title": "Вариант A — 3D / Дашборд", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.1","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-a-3d.html"], "status": "done", "startedAt": "2026-09-24T21:24:43+03:00", "finishedAt": "2026-09-24T21:34:47+03:00", "retries": 0, "repairs": 2, "files": ["ForNewDesign/prototypes/wallet-a-3d.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": [] },
    { "id": "02", "title": "Вариант B — Ч/Б / Классика", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.2","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-b-mono.html"], "status": "done", "startedAt": "2026-09-24T21:24:43+03:00", "finishedAt": "2026-09-24T21:35:14+03:00", "retries": 0, "repairs": 2, "files": ["ForNewDesign/prototypes/wallet-b-mono.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": [] },
    { "id": "03", "title": "Вариант C — Гроссбух / Редакционный", "requirements": ["R01","R02","R02.1","R03","R03.1","R05","R06","R06.3","R07","R07.1","R08i","R09i","R10i","R11i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/wallet-c-ledger.html"], "status": "done", "startedAt": "2026-09-24T21:24:43+03:00", "finishedAt": "2026-09-24T21:35:58+03:00", "retries": 0, "repairs": 1, "files": ["ForNewDesign/prototypes/wallet-c-ledger.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": [] },
    { "id": "04", "title": "Вариант A, итерация 2 — реальные предложения, пагинация, без карты", "requirements": ["R12","R13","R14","R15"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/wallet-a-3d.html"], "status": "done", "startedAt": "2026-09-24T21:53:57+03:00", "finishedAt": "2026-09-24T22:02:56+03:00", "retries": 0, "repairs": 0, "files": ["ForNewDesign/prototypes/wallet-a-3d.html"], "tests": { "passed": 0, "failed": 0 }, "concerns": ["содержимое ops-list в A теперь отличается от canonical-датасета B/C — осознанно, контент офферов A специфичен для этой итерации"] }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": [
    "3D в варианте A — CSS-глубина (тени/градиенты/перспектива), не WebGL/three.js",
    "прототипы — статический HTML в ForNewDesign/prototypes/, не Next.js-компоненты",
    "данные (баланс/операции/предложения) — моковые, общие для всех 3 вариантов, на основе реальных продуктов GoodWorker (VIP, Pro-план, PDF→Тест, личные услуги)"
  ], "emptyEnv": [], "craftNotes": [
    "interfaces.md изначально не зафиксировал дословный текст офферов VIP/«Личная услуга» (только Pro-план) — три независимых исполнителя написали разный текст; найдено ревью, зафиксировано в interfaces.md постфактум, все 3 файла приведены к единому виду"
  ] },
  "additions": [],
  "coverage": { "found": 3, "fixed": 3, "deferred": 0, "notes": "G2: баланс-как-карта (Visa-мотив) и явная отвязка Send/Request от офферов дописаны в вариант A; анкер «как щас главная» уточнён до конкретных токенов LandingPage.module.scss" },
  "blind": {
    "checked": 14,
    "agreed": 14,
    "drift": 0,
    "notes": "Слепая приёмка (только бриф, без спецификации/манифеста, живой запуск через puppeteer: скриншоты 1280/375px, консоль без ошибок, reduced-motion, реальный клик по свитчеру) согласна с манифестом по всем требованиям: раскладка, столбчатая диаграмма, три различных визуальных языка, анимации везде — всё «реализовано». Кнопки Send/Request/Send Again из референс-скриншота 2 отсутствуют во всех трёх — подтверждено как намеренная переформулировка по тексту брифа («под балансом... предложения»), не дрейф."
  }
}
