-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostVisibility" ADD VALUE 'STUDENTS';
ALTER TYPE "PostVisibility" ADD VALUE 'SELECTED';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "additionalTitle" TEXT,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vipExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PostAllowedStudent" (
    "postId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "PostAllowedStudent_pkey" PRIMARY KEY ("postId","studentId")
);

-- CreateIndex
CREATE INDEX "PostAllowedStudent_postId_idx" ON "PostAllowedStudent"("postId");

-- AddForeignKey
ALTER TABLE "PostAllowedStudent" ADD CONSTRAINT "PostAllowedStudent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAllowedStudent" ADD CONSTRAINT "PostAllowedStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
