-- One-time $1 gift when a VIP runs out of balance during a lecture.
ALTER TABLE "Student" ADD COLUMN "lectureGiftAt" TIMESTAMP(3);
ALTER TABLE "Teacher" ADD COLUMN "lectureGiftAt" TIMESTAMP(3);
