-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorBookHighlight" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "rects" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorBookHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TutorBookHighlight_fileId_ownerId_page_idx" ON "TutorBookHighlight"("fileId", "ownerId", "page");

-- AddForeignKey (guarded: re-running the file must not fail)
DO $$ BEGIN
  ALTER TABLE "TutorBookHighlight" ADD CONSTRAINT "TutorBookHighlight_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
