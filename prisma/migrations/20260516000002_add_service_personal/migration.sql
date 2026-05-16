ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "targetStudentId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isPersonal" BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Service_targetStudentId_fkey'
  ) THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_targetStudentId_fkey"
      FOREIGN KEY ("targetStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
