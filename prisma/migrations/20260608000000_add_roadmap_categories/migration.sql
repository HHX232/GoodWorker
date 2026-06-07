-- CreateTable: RoadmapCategory junction
CREATE TABLE IF NOT EXISTS "RoadmapCategory" (
    "roadmapId"  TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "RoadmapCategory_pkey" PRIMARY KEY ("roadmapId", "categoryId")
);

-- AddForeignKey
ALTER TABLE "RoadmapCategory"
    ADD CONSTRAINT "RoadmapCategory_roadmapId_fkey"
    FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoadmapCategory"
    ADD CONSTRAINT "RoadmapCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
