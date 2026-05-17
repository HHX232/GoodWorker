-- AlterTable: add spoken languages to Teacher
ALTER TABLE "Teacher" ADD COLUMN "languages" TEXT[] DEFAULT ARRAY['ru']::TEXT[];

-- AlterTable: add translation columns to Service
ALTER TABLE "Service" ADD COLUMN "titleTranslations" JSONB;
ALTER TABLE "Service" ADD COLUMN "descriptionTranslations" JSONB;
