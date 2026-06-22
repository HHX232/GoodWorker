-- CreateTable
CREATE TABLE "TopicTranslation" (
    "id" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicTranslation_original_langCode_key" ON "TopicTranslation"("original", "langCode");

-- CreateIndex
CREATE INDEX "TopicTranslation_original_idx" ON "TopicTranslation"("original");
