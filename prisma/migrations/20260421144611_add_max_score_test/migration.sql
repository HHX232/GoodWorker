/*
  Warnings:

  - You are about to drop the column `errorType` on the `StudentError` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "password" TEXT,
ALTER COLUMN "langCode" SET DEFAULT 'ru';

-- AlterTable
ALTER TABLE "StudentError" DROP COLUMN "errorType",
ADD COLUMN     "attemptId" TEXT;

-- AlterTable
ALTER TABLE "StudentSavedText" ADD COLUMN     "postId" TEXT;

-- AlterTable
ALTER TABLE "StudentTestAttempt" ADD COLUMN     "maxScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "pasportConfirmed" BOOLEAN,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "langCode" SET DEFAULT 'ru';

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCategory" (
    "testId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "TestCategory_pkey" PRIMARY KEY ("testId","categoryId")
);

-- CreateTable
CREATE TABLE "StudentErrorCategory" (
    "errorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "StudentErrorCategory_pkey" PRIMARY KEY ("errorId","categoryId")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_target_key" ON "OtpCode"("target");

-- CreateIndex
CREATE INDEX "OtpCode_target_idx" ON "OtpCode"("target");

-- AddForeignKey
ALTER TABLE "TestCategory" ADD CONSTRAINT "TestCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCategory" ADD CONSTRAINT "TestCategory_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentError" ADD CONSTRAINT "StudentError_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "StudentTestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentErrorCategory" ADD CONSTRAINT "StudentErrorCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentErrorCategory" ADD CONSTRAINT "StudentErrorCategory_errorId_fkey" FOREIGN KEY ("errorId") REFERENCES "StudentError"("id") ON DELETE CASCADE ON UPDATE CASCADE;
