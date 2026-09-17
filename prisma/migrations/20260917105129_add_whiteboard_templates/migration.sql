-- CreateTable
CREATE TABLE "WhiteboardTemplate" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhiteboardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhiteboardTemplate_teacherId_createdAt_idx" ON "WhiteboardTemplate"("teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhiteboardTemplate" ADD CONSTRAINT "WhiteboardTemplate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
