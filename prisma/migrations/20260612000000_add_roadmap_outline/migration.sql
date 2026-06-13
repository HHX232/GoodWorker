-- CreateTable
CREATE TABLE "RoadmapOutline" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "aiSteps" JSONB,
    "autoSteps" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapOutline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapOutline_roadmapId_key" ON "RoadmapOutline"("roadmapId");

-- AddForeignKey
ALTER TABLE "RoadmapOutline" ADD CONSTRAINT "RoadmapOutline_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
