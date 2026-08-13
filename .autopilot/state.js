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
  "updatedAt": "2026-08-13T05:05:00+03:00",
  "finishedAt": "2026-08-13T05:05:00+03:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-13T00:56:59+03:00", "finishedAt": "2026-08-13T01:00:00+03:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-13T01:00:00+03:00", "finishedAt": "2026-08-13T01:00:00+03:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-13T01:00:00+03:00", "finishedAt": "2026-08-13T01:05:00+03:00", "note": "3 вопроса" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-13T01:05:00+03:00", "finishedAt": "2026-08-13T01:12:00+03:00", "note": "G2: 4 находки закрыты" },
    { "id": "plan",      "status": "done", "startedAt": "2026-08-13T01:12:00+03:00", "finishedAt": "2026-08-13T01:20:00+03:00", "note": "4 таска, последовательно (один файл), T2" },
    { "id": "build",     "status": "done", "startedAt": "2026-08-13T01:20:00+03:00", "finishedAt": "2026-08-13T04:40:00+03:00", "note": "4 из 4 готовы" },
    { "id": "review",    "status": "done", "startedAt": "2026-08-13T01:20:00+03:00", "finishedAt": "2026-08-13T04:40:00+03:00", "note": "инлайн-скрины по тикетам; 1 дочинка Т01" },
    { "id": "final",     "status": "done", "startedAt": "2026-08-13T04:40:00+03:00", "finishedAt": "2026-08-13T05:05:00+03:00", "note": "G4 чист: 6/6 пунктов; +2-я кнопка VIP" }
  ],
  "requirements": {
    "total": 19, "done": 19, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 0, "dropped": 0
  },
  "tickets": [
    { "id": "01", "title": "Фундамент лаборатории: панель, токены, гаммы, лимиты/VIP", "requirements": ["R01","R02","R02.1","R02.2","R08","R08.1","R09","R10","R11","R12","R14i","R15i","R15.1","R15.2","R16i","R17i"], "blockedBy": [], "wave": 1, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "done", "retries": 0, "startedAt": "2026-08-13T01:20:00+03:00", "finishedAt": "2026-08-13T03:45:00+03:00", "repairs": 1, "commit": "2d9c6c2", "files": ["ForNewDesign/prototypes/v3-lab.html","ForNewDesign/prototypes/index.html"], "concerns": ["дочинен после обрыва по лимиту: show-only-active + рабочий H4"] },
    { "id": "02", "title": "Blueprint-hero H1 и H2 (изометрия, тёмная подложка)", "requirements": ["R04","R05","R04.1","R03","R13"], "blockedBy": ["01"], "wave": 2, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "done", "retries": 0, "finishedAt": "2026-08-13T04:05:00+03:00", "repairs": 0, "commit": "7f561df", "files": ["ForNewDesign/prototypes/v3-lab.html"], "concerns": [] },
    { "id": "03", "title": "Hero H3 (вопросы из бланка) + детализация бланка H4", "requirements": ["R06","R07"], "blockedBy": ["02"], "wave": 3, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "done", "retries": 0, "finishedAt": "2026-08-13T04:25:00+03:00", "repairs": 0, "commit": "7cfc5bb", "files": ["ForNewDesign/prototypes/v3-lab.html"], "concerns": [] },
    { "id": "04", "title": "Вариации «Три шага» (S2, S3)", "requirements": ["R09"], "blockedBy": ["03"], "wave": 4, "zone": ["ForNewDesign/prototypes/v3-lab.html"], "status": "done", "retries": 0, "finishedAt": "2026-08-13T04:40:00+03:00", "repairs": 0, "commit": "3edcd84", "files": ["ForNewDesign/prototypes/v3-lab.html"], "concerns": ["мёртвый CSS .steps-ph от прежних стабов — безвреден"] }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": ["Цена VIP — [ЦЕНА VIP — впиши] в «Лимитах» и финальной CTA","Ссылка оплаты VIP (href=#)","«Фото» на бланке H4 — авторский Ч/Б-плейсхолдер"], "assumptions": [], "emptyEnv": [] },
  "additions": ["экспорт CSS-пресета + Сбросить (R15.2)","сохранение настроек localStorage (R15.1)","reduced-motion/mobile фолбэки всех hero (R04.1/R01.1)"],
  "coverage": { "found": 4, "fixed": 4, "deferred": 0 },
  "blind": { "checked": 6, "agreed": 6, "drift": 0, "notes": "все 6 пунктов брифа реализованы; мелкий дрейф п.5 (одна кнопка VIP vs «кнопки») — чинится второй кнопкой; ограничение проверки: reduced-motion статичные кадры, mobile <500px не снят" }
}
