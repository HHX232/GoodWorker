-- CreateTable
CREATE TABLE "RoadmapView" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "viewerRole" "Role" NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapView_roadmapId_idx" ON "RoadmapView"("roadmapId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapView_roadmapId_studentId_key" ON "RoadmapView"("roadmapId", "studentId");

-- AddForeignKey
ALTER TABLE "RoadmapView" ADD CONSTRAINT "RoadmapView_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapView" ADD CONSTRAINT "RoadmapView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapView" ADD CONSTRAINT "RoadmapView_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
