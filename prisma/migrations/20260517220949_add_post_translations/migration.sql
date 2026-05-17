-- AlterTable: add AI translation fields to Post
ALTER TABLE "Post" ADD COLUMN "titleTranslations"           JSONB;
ALTER TABLE "Post" ADD COLUMN "additionalTitleTranslations" JSONB;
ALTER TABLE "Post" ADD COLUMN "contentTranslations"         JSONB;
