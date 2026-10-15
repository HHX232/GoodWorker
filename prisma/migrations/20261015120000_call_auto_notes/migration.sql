-- Video call auto-notes: a LectureNote per call participant (master = room owner).
ALTER TABLE "LectureNote" ADD COLUMN "callRoomId" TEXT;
ALTER TABLE "LectureNote" ADD COLUMN "tidiedSeq" INTEGER NOT NULL DEFAULT -1;

CREATE UNIQUE INDEX "LectureNote_callRoomId_ownerId_ownerRole_key" ON "LectureNote"("callRoomId", "ownerId", "ownerRole");
CREATE INDEX "LectureNote_callRoomId_idx" ON "LectureNote"("callRoomId");
