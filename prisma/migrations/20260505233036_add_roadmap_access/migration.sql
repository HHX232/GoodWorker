-- CreateEnum
CREATE TYPE "RoadmapAccessGrant" AS ENUM ('TEACHER', 'PURCHASE');

-- CreateTable
CREATE TABLE "RoadmapAccess" (
    "roadmapId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedBy" "RoadmapAccessGrant" NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapAccess_pkey" PRIMARY KEY ("roadmapId","studentId")
);

-- CreateIndex
CREATE INDEX "RoadmapAccess_roadmapId_idx" ON "RoadmapAccess"("roadmapId");

-- CreateIndex
CREATE INDEX "RoadmapAccess_studentId_idx" ON "RoadmapAccess"("studentId");

-- AddForeignKey
ALTER TABLE "RoadmapAccess" ADD CONSTRAINT "RoadmapAccess_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapAccess" ADD CONSTRAINT "RoadmapAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
