-- Captures schema drift that was applied to working databases via `prisma db push`
-- over time but never recorded as a migration. Written defensively (IF NOT EXISTS /
-- duplicate_object guards) so it's a no-op on a database that already has these
-- fields and brings a fresh database (one replaying migration history from scratch)
-- fully in line with the current schema.prisma.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RoomAccessType" AS ENUM ('ALL', 'NOBODY', 'MY_STUDENTS', 'SELECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "bodyTranslations" JSONB;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "titleTranslations" JSONB;

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "slug" TEXT;

ALTER TABLE "Roadmap" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'BYN';

ALTER TABLE "StudentError" ADD COLUMN IF NOT EXISTS "fragment" TEXT;

ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "serviceLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "VideoCallRoom" ADD COLUMN IF NOT EXISTS "accessType" "RoomAccessType" NOT NULL DEFAULT 'ALL';
ALTER TABLE "VideoCallRoom" ADD COLUMN IF NOT EXISTS "allowedEmails" TEXT[];
ALTER TABLE "VideoCallRoom" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeacherReview" (
    "id"         TEXT NOT NULL,
    "teacherId"  TEXT NOT NULL,
    "authorId"   TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'STUDENT',
    "authorName" TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "stars"      INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostTestAttempt" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "testId"    TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "score"     DOUBLE PRECISION,
    "maxScore"  DOUBLE PRECISION,
    "percent"   DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Homework" (
    "id"        TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "content"   JSONB NOT NULL,
    "sendAt"    TIMESTAMP(3),
    "dueAt"     TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HomeworkAssignment" (
    "id"           TEXT NOT NULL,
    "homeworkId"   TEXT NOT NULL,
    "studentId"    TEXT NOT NULL,
    "status"       "HomeworkStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt"    TIMESTAMP(3),
    "submittedAt"  TIMESTAMP(3),
    "grade"        INTEGER,
    "gradeComment" TEXT,
    "gradePhotos"  TEXT[],
    "reviewedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HomeworkBlockProgress" (
    "id"           TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "blockIndex"   INTEGER NOT NULL,
    "completedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkBlockProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupportRequest" (
    "id"         TEXT NOT NULL,
    "authorId"   TEXT NOT NULL,
    "authorRole" "Role" NOT NULL,
    "title"      TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "photoUrls"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "reply"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherReview_teacherId_authorId_key" ON "TeacherReview"("teacherId", "authorId");
CREATE INDEX IF NOT EXISTS "HomeworkAssignment_studentId_idx" ON "HomeworkAssignment"("studentId");
CREATE INDEX IF NOT EXISTS "HomeworkAssignment_homeworkId_idx" ON "HomeworkAssignment"("homeworkId");
CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkAssignment_homeworkId_studentId_key" ON "HomeworkAssignment"("homeworkId", "studentId");
CREATE INDEX IF NOT EXISTS "HomeworkBlockProgress_assignmentId_idx" ON "HomeworkBlockProgress"("assignmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkBlockProgress_assignmentId_blockIndex_key" ON "HomeworkBlockProgress"("assignmentId", "blockIndex");
CREATE INDEX IF NOT EXISTS "SupportRequest_authorId_idx" ON "SupportRequest"("authorId");
CREATE UNIQUE INDEX IF NOT EXISTS "Post_slug_key" ON "Post"("slug");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PostTestAttempt" ADD CONSTRAINT "PostTestAttempt_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Homework" ADD CONSTRAINT "Homework_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_homeworkId_fkey"
    FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "HomeworkBlockProgress" ADD CONSTRAINT "HomeworkBlockProgress_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportRequest" ADD CONSTRAINT "support_student_fk"
    FOREIGN KEY ("authorId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportRequest" ADD CONSTRAINT "support_teacher_fk"
    FOREIGN KEY ("authorId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
