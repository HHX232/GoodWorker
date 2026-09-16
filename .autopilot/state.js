window.STATE =
{
  "slug": "chat-system",
  "title": "Чат репетитор-ученик + бейджи непрочитанного",
  "mode": "semi",
  "depth": "normal",
  "briefFile": "2026-09-15-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-09-15T23:31:53+03:00",
  "updatedAt": "2026-09-16T00:45:00+03:00",
  "finishedAt": null,
  "tier": "T2",
  "stages": [
    { "id": "preflight", "status": "done",    "startedAt": "2026-09-15T23:31:53+03:00", "finishedAt": "2026-09-15T23:33:00+03:00" },
    { "id": "manifest",  "status": "done",    "startedAt": "2026-09-15T23:33:00+03:00", "finishedAt": "2026-09-15T23:36:00+03:00" },
    { "id": "briefing",  "status": "done",    "startedAt": "2026-09-15T23:36:00+03:00", "finishedAt": "2026-09-15T23:41:00+03:00", "note": "вопросов не потребовалось — нашёл компоненты в коде" },
    { "id": "spec",      "status": "done",    "startedAt": "2026-09-15T23:41:00+03:00", "finishedAt": "2026-09-15T23:58:00+03:00", "note": "G2: 3 находки закрыты" },
    { "id": "plan",      "status": "done",    "startedAt": "2026-09-15T23:58:00+03:00", "finishedAt": "2026-09-16T00:12:00+03:00", "note": "6 тасков, ярус T2, 4 волны" },
    { "id": "build",     "status": "active",  "startedAt": "2026-09-16T00:12:00+03:00", "note": "1 из 6 тасков готов" },
    { "id": "review",    "status": "pending" },
    { "id": "final",     "status": "pending" }
  ],
  "requirements": { "total": 24, "done": 3, "inTicket": 21, "inSpec": 0, "placeholder": 0, "deferred": 0, "dropped": 0 },
  "tickets": [
    { "id": "01", "title": "Модель данных и API чата", "requirements": ["R18i", "R18i.1", "R01.1"], "blockedBy": [], "wave": 1, "zone": ["prisma/schema.prisma", "prisma/migrations/", "app/api/chat/"], "status": "done", "startedAt": "2026-09-16T00:15:00+03:00", "finishedAt": "2026-09-16T00:45:00+03:00", "retries": 0, "repairs": 1, "commit": "f5c24fa", "files": ["prisma/schema.prisma", "prisma/migrations/20260915211725_add_chat_system/migration.sql", "src/shared/lib/chat/access.ts", "app/api/chat/conversations/route.ts", "app/api/chat/conversations/[id]/messages/route.ts", "app/api/chat/conversations/[id]/read/route.ts", "app/api/chat/unread-count/route.ts"], "concerns": [] },
    { "id": "02", "title": "Страница чата: список и адаптивный каркас", "requirements": ["R05", "R06", "R06.1", "R08", "R08i"], "blockedBy": ["01"], "wave": 2, "zone": ["app/(...)/chats/", "src/widgets/Chat/ChatShell/", "src/widgets/Chat/ConversationList/"], "status": "pending", "retries": 0, "repairs": 0 },
    { "id": "03", "title": "Диалог: сообщения, композер, поллинг", "requirements": ["R07", "R07.1", "R07.2", "R09", "R09.1", "R09.2", "R10", "R10.1", "R19i"], "blockedBy": ["02"], "wave": 3, "zone": ["src/widgets/Chat/ConversationView/", "src/widgets/Chat/MessageBubble/"], "status": "pending", "retries": 0, "repairs": 0 },
    { "id": "04", "title": "Вложения: фото/файлы, сжатие, ГС", "requirements": ["R11", "R11.1", "R11.2", "R12", "R12.1", "R16", "R16.1"], "blockedBy": ["03"], "wave": 4, "zone": ["src/widgets/Chat/Composer/", "src/shared/helpers/compressImageForUpload.ts"], "status": "pending", "retries": 0, "repairs": 0 },
    { "id": "05", "title": "Карточки событий: ДЗ, услуга, оплата", "requirements": ["R13", "R14", "R15"], "blockedBy": ["03"], "wave": 4, "zone": ["src/widgets/Chat/EventCard/", "app/api/homework/route.ts", "app/api/services/route.ts", "tg-bot/src/scheduler.ts", "tg-bot/src/db.ts"], "status": "pending", "retries": 0, "repairs": 0 },
    { "id": "06", "title": "Точки входа и бейджи непрочитанного", "requirements": ["R01", "R02", "R02.1", "R03", "R04", "R04.1", "R17i"], "blockedBy": ["02"], "wave": 3, "zone": ["src/widgets/Dashboard/StudentDetailModal/", "src/widgets/Dashboard/DashboardStudentSidebar/", "src/widgets/Dashboard/DashboardCenter/", "src/widgets/BaseUI/Header/"], "status": "pending", "retries": 0, "repairs": 0 }
  ],
  "singlePass": null,
  "tests": { "passed": 0, "failed": 0 },
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "found": 3, "fixed": 3, "deferred": 0 },
  "blind": null
}
