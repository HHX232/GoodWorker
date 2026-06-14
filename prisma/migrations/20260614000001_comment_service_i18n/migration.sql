ALTER TABLE "RoadmapComment" ADD COLUMN IF NOT EXISTS "textTranslations" JSONB;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "originalLang" TEXT;
