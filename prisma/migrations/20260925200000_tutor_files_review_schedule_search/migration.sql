-- AlterTable
ALTER TABLE "TutorFile" ADD COLUMN     "contentText" TEXT;

-- AlterTable
ALTER TABLE "TutorFileGrant" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "availableUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TutorFolder" ADD COLUMN     "submissionDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TutorFolderGrant" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "availableUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TutorFileReview" (
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "grade" TEXT,
    "comment" TEXT,
    "annotations" JSONB NOT NULL DEFAULT '[]',
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorFileReview_pkey" PRIMARY KEY ("fileId")
);

-- AddForeignKey
ALTER TABLE "TutorFileReview" ADD CONSTRAINT "TutorFileReview_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

