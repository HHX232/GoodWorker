-- AlterTable: add feedbackPromoGiven to Student and Teacher
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "feedbackPromoGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "feedbackPromoGiven" BOOLEAN NOT NULL DEFAULT false;
