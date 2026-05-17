-- AlterTable: add AI translation field to PostComment
ALTER TABLE "PostComment" ADD COLUMN "textTranslations" JSONB;
