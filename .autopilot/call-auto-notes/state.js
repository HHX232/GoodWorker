window.STATE =
{
  "slug": "call-auto-notes",
  "title": "Автоконспект звонка — дополнение: выдвижная панель, тихое сохранение, раздел ошибок",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-10-15-brief-panel.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-10-15T17:10:00+03:00",
  "updatedAt": "2026-10-15T21:15:00+03:00",
  "finishedAt": "2026-10-15T21:15:00+03:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-15T17:10:00+03:00",
      "finishedAt": "2026-10-15T17:11:00+03:00",
      "note": "дополнение к прогону call-auto-notes; прошлый стейт заархивирован"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-15T17:11:00+03:00",
      "finishedAt": "2026-10-15T17:15:00+03:00",
      "note": "+7 требований (R24–R30)"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "note": "блокирующих неизвестных нет; A7 — интервал 10 мин"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-15T17:15:00+03:00",
      "finishedAt": "2026-10-15T17:28:00+03:00",
      "note": "G2: 3 полу-покрытия дописаны"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-15T17:28:00+03:00",
      "finishedAt": "2026-10-15T17:30:00+03:00",
      "note": "2 таска, 1 волна: 04‖05"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-15T17:30:00+03:00",
      "note": "2 из 2 тасков готовы",
      "finishedAt": "2026-10-15T20:30:00+03:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-15T18:10:00+03:00",
      "finishedAt": "2026-10-15T21:15:00+03:00",
      "note": "04: 3 раунда; 05: 3 раунда + точечная правка ef2a01e"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-15T20:50:00+03:00",
      "finishedAt": "2026-10-15T21:15:00+03:00",
      "note": "слепая приёмка: build ок, 4/4 пункта реализовано; панель проверена глазами на временной странице; живой звонок не запускался"
    }
  ],
  "requirements": {
    "total": 7,
    "done": 7,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "04",
      "title": "Сервер: чтение для панели, тихое сохранение, раздел ошибок",
      "requirements": [
        "R24",
        "R26",
        "R27",
        "R28",
        "R29",
        "R30"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "prisma/",
        "src/shared/lib/callNotes/",
        "app/api/call/notes/"
      ],
      "status": "done",
      "startedAt": "2026-10-15T17:30:00+03:00",
      "retries": 0,
      "repairs": 1,
      "finishedAt": "2026-10-15T20:30:00+03:00",
      "tests": "errorsSection ok; docOps ok; tsc/eslint clean; 21/21 на тестовой БД",
      "commit": "bddb494"
    },
    {
      "id": "05",
      "title": "Выдвижная панель конспекта в звонке",
      "requirements": [
        "R25",
        "R26",
        "R27",
        "R29",
        "R30"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/widgets/VideoRoom/"
      ],
      "status": "done",
      "startedAt": "2026-10-15T17:30:00+03:00",
      "retries": 0,
      "repairs": 1,
      "finishedAt": "2026-10-15T20:05:00+03:00",
      "tests": "tsc/eslint clean; tileGrid ok",
      "commit": "2c4e42c"
    }
  ],
  "concerns": [
    "T05: если связь с комнатой у владельца оборвалась во время разбора ошибок, finish уходит только через /api/call/end после закрытия комнаты",
    "T04: если в финале упадёт уведомление уже после сохранения файла, человек может получить второе уведомление «не удалось сохранить»"
  ],
  "blind": {
    "build": "npm run build ok; errorsSection/docOps/tileGrid ok",
    "drift": [],
    "notRun": "живой звонок с LiveKit"
  }
}
