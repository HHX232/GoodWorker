-- AlterTable
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "isBook" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "bookTitle" TEXT;
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "pageCount" INTEGER;
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "coverKind" TEXT;
ALTER TABLE "TutorFile" ADD COLUMN IF NOT EXISTS "spineColor" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TutorFile_teacherId_isBook_idx" ON "TutorFile"("teacherId", "isBook");

-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorBookSave" (
    "fileId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorBookSave_pkey" PRIMARY KEY ("fileId","ownerId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorBookmark" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "page" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorBookProgress" (
    "fileId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "lastPage" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorBookProgress_pkey" PRIMARY KEY ("fileId","ownerId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TutorBookRead" (
    "fileId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "firstReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorBookRead_pkey" PRIMARY KEY ("fileId","studentId","page")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TutorBookmark_fileId_ownerId_page_key" ON "TutorBookmark"("fileId", "ownerId", "page");

-- AddForeignKey (guarded: re-running the file must not fail)
DO $$ BEGIN
  ALTER TABLE "TutorBookSave" ADD CONSTRAINT "TutorBookSave_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TutorBookmark" ADD CONSTRAINT "TutorBookmark_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TutorBookProgress" ADD CONSTRAINT "TutorBookProgress_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TutorBookRead" ADD CONSTRAINT "TutorBookRead_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
