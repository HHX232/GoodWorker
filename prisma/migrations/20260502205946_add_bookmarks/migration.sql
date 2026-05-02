-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "xpath" TEXT NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "length" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bookmark_authorId_idx" ON "Bookmark"("authorId");

-- CreateIndex
CREATE INDEX "Bookmark_sourceType_sourceId_idx" ON "Bookmark"("sourceType", "sourceId");
