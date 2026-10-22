-- CreateEnum
CREATE TYPE "LectureStatus" AS ENUM ('RECORDING', 'FINALIZING', 'READY');

-- AlterTable
ALTER TABLE "StorageSettings" ADD COLUMN     "studentQuotaGb" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "StudentFolder" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "ancestorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "lectureNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerRole" "Role" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LectureStatus" NOT NULL DEFAULT 'RECORDING',
    "docJson" JSONB,
    "processedSeq" INTEGER NOT NULL DEFAULT -1,
    "keepAudio" BOOLEAN NOT NULL DEFAULT false,
    "recordedMs" INTEGER NOT NULL DEFAULT 0,
    "aiPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "aiCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "costKopecks" INTEGER NOT NULL DEFAULT 0,
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LectureNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureChunk" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "draftText" TEXT NOT NULL DEFAULT '',
    "finalText" TEXT,
    "audioKey" TEXT,
    "audioBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LectureSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "baseMinutes" INTEGER NOT NULL DEFAULT 30,
    "basePer5MinKopecks" INTEGER NOT NULL DEFAULT 500,
    "extraPer5MinKopecks" INTEGER NOT NULL DEFAULT 200,
    "aiMarkup" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "aiInputPer1MKopecks" INTEGER NOT NULL DEFAULT 2600,
    "aiOutputPer1MKopecks" INTEGER NOT NULL DEFAULT 10000,
    "maxMinutesPerDay" INTEGER NOT NULL DEFAULT 240,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LectureSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFolder_studentId_idx" ON "StudentFolder"("studentId");

-- CreateIndex
CREATE INDEX "StudentFolder_parentId_idx" ON "StudentFolder"("parentId");

-- CreateIndex
CREATE INDEX "StudentFile_studentId_idx" ON "StudentFile"("studentId");

-- CreateIndex
CREATE INDEX "StudentFile_folderId_idx" ON "StudentFile"("folderId");

-- CreateIndex
CREATE INDEX "LectureNote_ownerId_ownerRole_idx" ON "LectureNote"("ownerId", "ownerRole");

-- CreateIndex
CREATE UNIQUE INDEX "LectureChunk_lectureId_seq_key" ON "LectureChunk"("lectureId", "seq");

-- AddForeignKey
ALTER TABLE "StudentFolder" ADD CONSTRAINT "StudentFolder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFolder" ADD CONSTRAINT "StudentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StudentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFile" ADD CONSTRAINT "StudentFile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFile" ADD CONSTRAINT "StudentFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "StudentFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureChunk" ADD CONSTRAINT "LectureChunk_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "LectureNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
