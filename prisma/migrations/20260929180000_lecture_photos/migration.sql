-- CreateTable
CREATE TABLE "LecturePhoto" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LecturePhoto_lectureId_idx" ON "LecturePhoto"("lectureId");

-- AddForeignKey
ALTER TABLE "LecturePhoto" ADD CONSTRAINT "LecturePhoto_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "LectureNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
