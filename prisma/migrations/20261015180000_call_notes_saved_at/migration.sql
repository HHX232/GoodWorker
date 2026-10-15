-- Call notes: time of the last quiet mid-call save of the master into participants' storage.
ALTER TABLE "LectureNote" ADD COLUMN "savedAt" TIMESTAMP(3);
