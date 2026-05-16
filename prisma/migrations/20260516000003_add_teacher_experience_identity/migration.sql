ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "passportDocumentUrl" TEXT;

CREATE TABLE IF NOT EXISTS "TeacherExperience" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "organization" TEXT,
  "yearFrom" INTEGER NOT NULL,
  "yearTo" INTEGER,
  "description" TEXT,
  "documentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "verifiedAt" TIMESTAMP(3),
  "verifiedByAdmin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherExperience_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeacherExperience_teacherId_fkey'
  ) THEN
    ALTER TABLE "TeacherExperience" ADD CONSTRAINT "TeacherExperience_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
