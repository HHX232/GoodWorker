-- Create ModerationStatus enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "ModerationStatus" AS ENUM ('PUBLISHED', 'PENDING', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Student: add ban fields and telegram fields
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "telegramChatId" BIGINT,
  ADD COLUMN IF NOT EXISTS "telegramLinkToken" TEXT,
  ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "banReason" TEXT;

-- Unique index on Student.telegramLinkToken
CREATE UNIQUE INDEX IF NOT EXISTS "Student_telegramLinkToken_key" ON "Student"("telegramLinkToken");

-- AlterTable Teacher: add ban fields and telegram fields
ALTER TABLE "Teacher"
  ADD COLUMN IF NOT EXISTS "telegramChatId" BIGINT,
  ADD COLUMN IF NOT EXISTS "telegramLinkToken" TEXT,
  ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "banReason" TEXT;

-- Unique index on Teacher.telegramLinkToken
CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_telegramLinkToken_key" ON "Teacher"("telegramLinkToken");

-- AlterTable Post: add moderationStatus
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable Roadmap: add moderationStatus
ALTER TABLE "Roadmap"
  ADD COLUMN IF NOT EXISTS "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable Conference: add durationMinutes and serviceId
ALTER TABLE "Conference"
  ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "serviceId" TEXT;

-- Foreign key for Conference.serviceId -> Service.id (if Service table exists)
DO $$ BEGIN
  ALTER TABLE "Conference" ADD CONSTRAINT "Conference_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_table THEN null;
END $$;

-- Re-create tables from rolled-back migration 20260513000000_add_bookmark_videocall

CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "xpath" TEXT NOT NULL DEFAULT '',
    "contextText" TEXT NOT NULL DEFAULT '',
    "offset" INTEGER NOT NULL DEFAULT 0,
    "length" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoCallRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerIdentity" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "transcriptRaw" TEXT,
    "transcriptJson" JSONB,

    CONSTRAINT "VideoCallRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoCallParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" "Role",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCallParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Bookmark_authorId_idx" ON "Bookmark"("authorId");
CREATE INDEX IF NOT EXISTS "Bookmark_sourceType_sourceId_idx" ON "Bookmark"("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoCallRoom_name_key" ON "VideoCallRoom"("name");
CREATE INDEX IF NOT EXISTS "VideoCallParticipant_roomId_idx" ON "VideoCallParticipant"("roomId");
CREATE INDEX IF NOT EXISTS "VideoCallParticipant_userId_idx" ON "VideoCallParticipant"("userId");

DO $$ BEGIN
  ALTER TABLE "VideoCallParticipant"
    ADD CONSTRAINT "VideoCallParticipant_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "VideoCallRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
