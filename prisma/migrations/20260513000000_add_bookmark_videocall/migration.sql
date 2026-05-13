-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "VideoCallParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" "Role",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bookmark_authorId_idx" ON "Bookmark"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bookmark_sourceType_sourceId_idx" ON "Bookmark"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VideoCallRoom_name_key" ON "VideoCallRoom"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoCallParticipant_roomId_idx" ON "VideoCallParticipant"("roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoCallParticipant_userId_idx" ON "VideoCallParticipant"("userId");

-- AddForeignKey (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VideoCallParticipant_roomId_fkey'
      AND table_name = 'VideoCallParticipant'
  ) THEN
    ALTER TABLE "VideoCallParticipant"
      ADD CONSTRAINT "VideoCallParticipant_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "VideoCallRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
