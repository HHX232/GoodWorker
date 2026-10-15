window.STATE =
{
  "slug": "promo-video-block",
  "title": "Блок промо-видео для главной — варианты дизайна",
  "mode": "semi",
  "depth": "normal",
  "tier": "T0",
  "briefFile": "2026-10-15-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-10-15T19:00:00+03:00",
  "updatedAt": "2026-10-15T22:30:00+03:00",
  "finishedAt": "2026-10-15T20:05:00+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-15T19:00:00+03:00",
      "finishedAt": "2026-10-15T19:04:00+03:00",
      "note": "стейт отдельно: корневой state.js занят незавершённым call-auto-notes"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-15T19:04:00+03:00",
      "finishedAt": "2026-10-15T19:08:00+03:00",
      "note": "10 требований"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "блокирующих неизвестных нет; оба ролика — в каждом варианте"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-15T19:08:00+03:00",
      "finishedAt": "2026-10-15T19:20:00+03:00",
      "note": "G2: 2 полу-покрытия дописаны"
    },
    {
      "id": "plan",
      "status": "skipped",
      "note": "ярус T0 — без разбивки на таски"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-15T19:21:00+03:00",
      "finishedAt": "2026-10-15T19:45:00+03:00",
      "note": "1 файл, 4 варианта; смоук 1280/375 пройден"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-15T19:45:00+03:00",
      "finishedAt": "2026-10-15T19:54:00+03:00",
      "note": "5 дефектов найдено и исправлено"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-15T19:55:00+03:00",
      "finishedAt": "2026-10-15T20:05:00+03:00",
      "note": "приёмка вслепую: 11 да, 3 частично — все ожидаемые"
    }
  ],
  "requirements": {
    "total": 17,
    "done": 17,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "status": "done",
    "startedAt": "2026-10-15T19:21:00+03:00",
    "finishedAt": "2026-10-15T19:54:00+03:00",
    "files": [
      "ForNewDesign/prototypes/promo-video-variants.html",
      "src/_pages/PublickPages/LandingPage/PromoVideo.tsx",
      "src/_pages/PublickPages/LandingPage/PromoVideo.module.scss",
      "src/_pages/PublickPages/LandingPage/audience.ts",
      "src/_pages/PublickPages/LandingPage/LandingPage.tsx",
      "messages/*.json",
      "public/promo/*"
    ],
    "tests": null,
    "commit": null
  },
  "tests": null,
  "debt": {
    "placeholders": [
      "Тексты в блоках — черновой UI-копирайт"
    ],
    "assumptions": [
      "Два ролика (репетиторам/ученикам) — оба в каждом варианте",
      "Прототип — статический HTML в ForNewDesign/prototypes/, встраивание в Next.js после выбора"
    ],
    "emptyEnv": []
  },
  "additions": [
    "Доработка A и C по второму сообщению (R11–R13)",
    "Вариант A встроен в главную (R14–R17)"
  ],
  "coverage": {
    "found": 2,
    "fixed": 2,
    "deferred": 0
  },
  "blind": {
    "agreed": 11,
    "partial": 3,
    "drift": 0,
    "notes": [
      "C в раскрытом виде растёт до 420px — по замыслу, по клику",
      "В LandingPage.tsx не встроено — следующий шаг после выбора",
      "PiP не проверялся ни запуском, ни вручную"
    ]
  }
}
