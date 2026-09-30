-- AlterTable
ALTER TABLE "LectureNote" ADD COLUMN     "docVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shareEditToken" TEXT,
ADD COLUMN     "shareViewToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LectureNote_shareViewToken_key" ON "LectureNote"("shareViewToken");

-- CreateIndex
CREATE UNIQUE INDEX "LectureNote_shareEditToken_key" ON "LectureNote"("shareEditToken");
