-- Call notes: fingerprint of the doc the last quiet save filed (save again only if it changed).
ALTER TABLE "LectureNote" ADD COLUMN "savedHash" TEXT;
