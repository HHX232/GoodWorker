-- CreateTable
CREATE TABLE "RoadmapNodeFeedback" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapNodeFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapNodeFeedback_roadmapId_idx" ON "RoadmapNodeFeedback"("roadmapId");

-- CreateIndex
CREATE INDEX "RoadmapNodeFeedback_studentId_idx" ON "RoadmapNodeFeedback"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapNodeFeedback_roadmapId_nodeId_studentId_key" ON "RoadmapNodeFeedback"("roadmapId", "nodeId", "studentId");

-- AddForeignKey
ALTER TABLE "RoadmapNodeFeedback" ADD CONSTRAINT "RoadmapNodeFeedback_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapNodeFeedback" ADD CONSTRAINT "RoadmapNodeFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
