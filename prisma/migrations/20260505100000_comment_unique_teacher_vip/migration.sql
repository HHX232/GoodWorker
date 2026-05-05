-- Remove duplicate RoadmapComment rows, keeping the most recent per (roadmapId, authorId)
DELETE FROM "RoadmapComment" a
USING "RoadmapComment" b
WHERE a."createdAt" < b."createdAt"
  AND a."roadmapId" = b."roadmapId"
  AND a."authorId"  = b."authorId";

-- Add unique constraint on RoadmapComment
CREATE UNIQUE INDEX "RoadmapComment_roadmapId_authorId_key"
  ON "RoadmapComment"("roadmapId", "authorId");

-- Add VIP fields to Teacher
ALTER TABLE "Teacher" ADD COLUMN "isVip"        BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "Teacher" ADD COLUMN "vipExpiresAt" TIMESTAMP(3);
