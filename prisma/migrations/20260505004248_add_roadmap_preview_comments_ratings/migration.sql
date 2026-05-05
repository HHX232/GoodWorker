-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN     "previewImageUrl" TEXT;

-- CreateTable
CREATE TABLE "RoadmapComment" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapRating" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapComment_roadmapId_idx" ON "RoadmapComment"("roadmapId");

-- CreateIndex
CREATE INDEX "RoadmapComment_authorId_idx" ON "RoadmapComment"("authorId");

-- CreateIndex
CREATE INDEX "RoadmapRating_roadmapId_idx" ON "RoadmapRating"("roadmapId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapRating_roadmapId_authorId_key" ON "RoadmapRating"("roadmapId", "authorId");

-- AddForeignKey
ALTER TABLE "RoadmapComment" ADD CONSTRAINT "RoadmapComment_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapRating" ADD CONSTRAINT "RoadmapRating_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
