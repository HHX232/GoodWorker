# 01 — Модель данных и API чата

**Требования:** R18i, R18i.1, R01.1
**Blocked by:** —
**Зона:** `prisma/schema.prisma`, `prisma/migrations/`, `app/api/chat/`
**Волна:** 1
**Status:** ready

## Что должно заработать

Две новые Prisma-модели, миграция применена к локальной dev-базе, и полный
набор API-роутов поверх них — можно через curl создать диалог между реальным
репетитором и учеником (сид-аккаунты), отправить сообщение, получить историю,
пометить прочитанным и узнать суммарное число непрочитанных.

## Из брифа, дословно

> «В чате можно отправлять файлы и текста»
> (нужна модель данных — в проекте её ещё нет, см. манифест R18i)

## Разделы спецификации

Спецификация: `.autopilot/chat-system/spec.md` §«Решения по реализации»
(модель данных, API), §«Границы и швы» (модуль `chat/data`), История 30
(R18i.1 — доступ). Читай оттуда точные поля моделей и список эндпоинтов —
не изобретай заново.

## Схема (ориентир, не копировать слепо — сверься со спецификацией)

```prisma
model Conversation {
  id            String   @id @default(uuid())
  teacherId     String
  studentId     String
  createdAt     DateTime @default(now())
  lastMessageAt DateTime @default(now())
  teacher       Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  student       Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  messages      ChatMessage[]
  @@unique([teacherId, studentId])
  @@index([teacherId, lastMessageAt])
  @@index([studentId, lastMessageAt])
}

model ChatMessage {
  id             String       @id @default(uuid())
  conversationId String
  senderRole     Role
  text           String?
  attachmentUrl  String?
  attachmentType String?
  attachmentName String?
  attachmentSize Int?
  eventType      String?
  eventPayload   Json?
  isRead         Boolean      @default(false)
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}
```

Не забудь добавить обратные связи `conversationsAsTeacher`/`conversationsAsStudent`
(назови по своему усмотрению) на моделях `Teacher`/`Student` — Prisma
потребует их для двусторонних отношений.

## Критерии приёмки

- [ ] Миграция создана и применена (`npx prisma migrate deploy` — с `set -a; source .env; set +a` перед этим), `npx prisma generate` прогнан
- [ ] `POST /api/chat/conversations {otherId}` — get-or-create, 403 если нет связи `TeacherStudent` между текущим пользователем и `otherId`
- [ ] `GET /api/chat/conversations` — список для текущего пользователя (роль TEACHER или STUDENT), с другой стороной (id/имя/аватар), превью последнего сообщения, `unreadCount` на диалог
- [ ] `GET /api/chat/conversations/[id]/messages?before=&limit=` — история, 403 на чужой диалог
- [ ] `POST /api/chat/conversations/[id]/messages` — текст и/или вложение, отклоняет пустое сообщение (ни текста, ни вложения), 403 на чужой диалог
- [ ] `PATCH /api/chat/conversations/[id]/read` — отмечает прочитанным всё от собеседника
- [ ] `GET /api/chat/unread-count` — суммарно по всем диалогам текущего пользователя
- [ ] Реально проверено через curl с сессией `teacher@seed.dev` и `student@seed.dev` — создание диалога, отправка в обе стороны, счётчик непрочитанного меняется правильно, попытка достучаться до чужого `conversationId` от третьего аккаунта (или без сессии) даёт 401/403
- [ ] Все использованные эндпоинты и точная форма JSON-ответов дописаны в `.autopilot/chat-system/interfaces.md` под «Контракт API chat/data» — следующие тикеты будут читать оттуда сигнатуры, а не гадать
- [ ] Коммит только своих файлов, `git push origin main`
