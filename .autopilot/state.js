window.STATE =
{
  "slug": "chess",
  "title": "Шахматы в GoodWorker: движок, скины, задачи, курсы, доска в звонке, лендинг, ИИ-тренер",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-10-15-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-10-15T23:45:00+03:00",
  "updatedAt": "2026-10-21T03:30:00+03:00",
  "finishedAt": "2026-10-21T03:30:00+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-15T23:45:00+03:00",
      "finishedAt": "2026-10-15T23:52:00+03:00",
      "note": "новый прогон в настроенном репо; прошлый стейт — call-auto-notes/state.js"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-15T23:52:00+03:00",
      "finishedAt": "2026-10-15T23:55:00+03:00",
      "note": "26 требований (20 + 6 подразумеваемых)"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-10-15T23:55:00+03:00",
      "finishedAt": "2026-10-16T00:05:00+03:00",
      "note": "3 вопроса: курсы в текущем конструкторе; лимиты ИИ гость/вошёл/VIP; лендинг — сначала прототипы"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-16T00:05:00+03:00",
      "finishedAt": "2026-10-16T10:05:00+03:00",
      "note": "G2: 9 находок, 7 закрыто в «Дополнениях»; R11 deferred"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-16T10:05:00+03:00",
      "finishedAt": "2026-10-16T10:25:00+03:00",
      "note": "T2: 8 тасков, 2 волны (3 + 5)"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-16T10:25:00+03:00",
      "note": "16 из 16 тасков готовы",
      "finishedAt": "2026-10-20T17:45:00+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-16T11:10:00+03:00",
      "finishedAt": "2026-10-20T17:45:00+03:00",
      "note": "каждый таск: 2 ревьюера; 7 ремонтов"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-20T17:46:00+03:00",
      "note": "волны 7–8 закоммичены; слепая приёмка по последним дополнениям не перезапускалась",
      "finishedAt": "2026-10-20T18:30:00+03:00"
    }
  ],
  "requirements": {
    "total": 57,
    "done": 66,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 1,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Ядро: движок, доска, классический скин, звук, тренер-клиент",
      "requirements": [
        "R01",
        "R02",
        "R13",
        "R14",
        "R15",
        "R16",
        "R21",
        "R25i",
        "R26i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/shared/lib/chess/",
        "src/widgets/Chess/",
        "public/stockfish/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T10:28:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T13:10:00+03:00",
      "tests": "coachModel ok; evalFormat ok; tsc/eslint; браузер /game/chess",
      "commit": "7eb0bba"
    },
    {
      "id": "02",
      "title": "Сервер: схема, предмет «Шахматы», задачи Lichess, API тренера",
      "requirements": [
        "R05",
        "R06",
        "R08",
        "R17",
        "R22i",
        "R24i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "prisma/",
        "app/api/chess/",
        "src/shared/lib/chess/server/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T10:28:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T12:05:00+03:00",
      "tests": "coachInput ok; puzzleRating ok; curl 200/400/401/404/429",
      "commit": "7f9a9d7"
    },
    {
      "id": "08",
      "title": "Три прототипа Hero лендинга",
      "requirements": [
        "R12",
        "R21"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "ForNewDesign/prototypes/chess-hero-*"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T10:28:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T12:15:00+03:00",
      "tests": "смоук 360/1440, reduced-motion, свитчер, копирайт md5",
      "commit": "9e14128"
    },
    {
      "id": "03",
      "title": "Четыре скина по референсам",
      "requirements": [
        "R03",
        "R04"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/widgets/Chess/skins/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T14:45:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T17:25:00+03:00",
      "tests": "визуально 77px и 40px, тёмная тема; tsc/eslint",
      "commit": "45a8108"
    },
    {
      "id": "04",
      "title": "Хаб и игра против движка с тренером",
      "requirements": [
        "R01",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "app/chess/play/",
        "src/_pages/Chess/Play/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T13:12:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T16:40:00+03:00",
      "tests": "gameFacts ok; tsc/eslint; браузер ур.1/8, Подробнее, каталог",
      "commit": "68525c2"
    },
    {
      "id": "05",
      "title": "Задачи, тренировки, тактики и дебюты",
      "requirements": [
        "R05",
        "R18",
        "R19",
        "R20"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "app/chess/puzzles/",
        "app/chess/learn/",
        "src/shared/lib/chess/data/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T13:12:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T18:40:00+03:00",
      "tests": "puzzleRun ok; data ok; tsc/eslint; браузер на живых задачах",
      "commit": "01e14ed"
    },
    {
      "id": "06",
      "title": "Общая доска в видеозвонке",
      "requirements": [
        "R09",
        "R10",
        "R23i"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 2,
      "zone": [
        "src/widgets/VideoRoom/",
        "app/api/call/rooms/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T13:12:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-16T15:00:00+03:00",
      "tests": "chessSync ok; tsc 0; curl subjectSlug; живой звонок не запускался",
      "commit": "87e954b"
    },
    {
      "id": "07",
      "title": "Шахматные блоки в тестах и курсах",
      "requirements": [
        "R07"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/features/Tasks/",
        "src/widgets/Tasks/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T13:40:00+03:00",
      "repairs": 2,
      "finishedAt": "2026-10-16T18:00:00+03:00",
      "tests": "puzzle ok; tsc 0; браузер плеер ученика; редактор узла курса не открывался",
      "commit": "22c7a4f"
    },
    {
      "id": "09",
      "title": "Стрелки лучших ходов, раздельные доска/фигуры, аватар тренера",
      "requirements": [
        "G01",
        "G02",
        "G03",
        "G04"
      ],
      "blockedBy": [],
      "wave": 3,
      "zone": [
        "src/widgets/Chess/",
        "src/_pages/Chess/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T21:15:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-19T21:25:00+03:00",
      "commit": "7279250"
    },
    {
      "id": "10",
      "title": "Шахматный узел в road-map",
      "requirements": [
        "G10"
      ],
      "blockedBy": [],
      "wave": 3,
      "zone": [
        "src/features/Roadmap/",
        "src/widgets/RoadMap/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-16T22:30:00+03:00",
      "finishedAt": "2026-10-19T21:25:00+03:00",
      "commit": "7279250"
    },
    {
      "id": "11",
      "title": "Прогресс: огонёк, очки и значки, Эло, профиль",
      "requirements": [
        "G12",
        "G13",
        "G14"
      ],
      "blockedBy": [],
      "wave": 4,
      "zone": [
        "prisma/",
        "app/api/chess/activity|profile",
        "src/widgets/Chess/Progress/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T21:30:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-19T22:35:00+03:00",
      "commit": "243e6f2",
      "tests": "progress ok; curl activity/profile; браузер бот ур.1"
    },
    {
      "id": "14",
      "title": "Набор фигур «Сетка»",
      "requirements": [
        "G18"
      ],
      "blockedBy": [],
      "wave": 4,
      "zone": [
        "src/widgets/Chess/skins/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T21:30:00+03:00",
      "finishedAt": "2026-10-19T21:55:00+03:00",
      "commit": "78fb726",
      "tests": "tsc 0; рендер 12 кодов; скриншоты 6 досок"
    },
    {
      "id": "12",
      "title": "Онлайн-партии и поиск игроков",
      "requirements": [
        "G16",
        "G17",
        "G14"
      ],
      "blockedBy": [
        "11"
      ],
      "wave": 5,
      "zone": [
        "prisma/",
        "app/api/chess/games|seek|players",
        "src/_pages/Chess/Online|Game"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T22:37:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-20T16:30:00+03:00",
      "commit": "df03c73",
      "tests": "online ok; curl гонки 200+409; двойная сдача — Эло один раз"
    },
    {
      "id": "13",
      "title": "Модалки, режимы, шторм задач",
      "requirements": [
        "G15",
        "G16",
        "G21",
        "G22"
      ],
      "blockedBy": [
        "11"
      ],
      "wave": 5,
      "zone": [
        "src/widgets/Chess/Settings/",
        "src/_pages/Chess/Play|Hub|Puzzles|Storm"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T22:37:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-20T17:20:00+03:00",
      "commit": "cf542ee",
      "tests": "storm ok; data ok; браузер"
    },
    {
      "id": "15",
      "title": "Шахматный репетитор",
      "requirements": [
        "G11"
      ],
      "blockedBy": [
        "11",
        "12"
      ],
      "wave": 5,
      "zone": [
        "профиль и каталог репетиторов"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T22:37:00+03:00",
      "finishedAt": "2026-10-20T01:00:00+03:00",
      "commit": "55656fe",
      "tests": "curl фильтр каталога; puppeteer запись/вызов"
    },
    {
      "id": "16",
      "title": "Разбор партии: классы ходов, точность, график",
      "requirements": [
        "G19",
        "G20"
      ],
      "blockedBy": [],
      "wave": 6,
      "zone": [
        "src/shared/lib/chess/reviewModel.ts",
        "src/widgets/Chess/Review/",
        "src/_pages/Chess/Analysis/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-19T23:20:00+03:00",
      "repairs": 1,
      "commit": "889490b, 664700d",
      "tests": "review ok; Оперная партия",
      "finishedAt": "2026-10-20T17:45:00+03:00"
    },
    {
      "id": "17",
      "title": "Все боты сразу, награды-скины и раскраски, VIP из админки",
      "requirements": [
        "G23",
        "G24",
        "G25",
        "G31"
      ],
      "blockedBy": [],
      "wave": 7,
      "zone": [
        "prisma/",
        "src/widgets/Chess/skins/",
        "admin"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-20T19:00:00+03:00",
      "note": "ревью чистое; коммит вместе с T18 (общие файлы)",
      "finishedAt": "2026-10-21T03:30:00+03:00",
      "commit": "см. общий коммит волн 7–8"
    },
    {
      "id": "18",
      "title": "Быстрый доступ: оболочка, модалки, панели + polish",
      "requirements": [
        "G26",
        "G27",
        "G28",
        "G29"
      ],
      "blockedBy": [],
      "wave": 7,
      "zone": [
        "src/_pages/Chess/",
        "src/widgets/Chess/Shell/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-20T19:00:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-21T03:30:00+03:00",
      "commit": "см. общий коммит волн 7–8"
    },
    {
      "id": "19",
      "title": "Путь задач по ступеням",
      "requirements": [
        "G30"
      ],
      "blockedBy": [
        "18"
      ],
      "wave": 8,
      "zone": [
        "src/_pages/Chess/Puzzles/",
        "src/widgets/Chess/Path/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-20T22:20:00+03:00",
      "finishedAt": "2026-10-21T03:30:00+03:00",
      "commit": "см. общий коммит волн 7–8"
    },
    {
      "id": "20",
      "title": "Эффекты взятия и появления фигур",
      "requirements": [
        "G34"
      ],
      "blockedBy": [],
      "wave": 8,
      "zone": [
        "src/widgets/Chess/Board/"
      ],
      "status": "done",
      "retries": 0,
      "startedAt": "2026-10-20T21:50:00+03:00",
      "repairs": 1,
      "finishedAt": "2026-10-21T03:30:00+03:00",
      "commit": "см. общий коммит волн 7–8"
    }
  ],
  "coverage": {
    "findings": 9,
    "fixed": 7,
    "note": "R11 боевой лендинг — deferred по ответу пользователя; доп. возможности привязаны к требованиям"
  },
  "concerns": [
    "T06: «Шахматы» в модалке создания звонка видны учителю, только если предмет есть в его профиле (существующее правило платформы для всех предметов)",
    "T06: живой звонок в двух окнах не запускался — синк проверен самопроверкой и чтением кода",
    "Тренер (DeepSeek) изредка ошибается в фактах вопреки запрету в промпте — в живом ответе назвал защищённую пешку незащищённой",
    "T10: шахматная задача в road-map засчитывается и при ошибках (в тесте/решебнике — нет); в статистику ответов репетитора не попадает"
  ],
  "blind": {
    "build": "dev :3000 ок; 15 самопроверок ok; tsc чисто",
    "drift": [],
    "notRun": "живой видеозвонок на два окна (LiveKit); вход второго игрока по ссылке; полный забег шторма",
    "partial": [
      "дни VIP за значки — VIP_REWARDS пустые (решение пользователя)"
    ]
  }
}
