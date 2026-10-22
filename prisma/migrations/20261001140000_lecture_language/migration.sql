-- /lecture: the speech language of a lecture ("ru" | "en" | "auto").
ALTER TABLE "LectureNote" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';
