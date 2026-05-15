-- Add topic column to VideoCallRoom (nullable, idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'VideoCallRoom' AND column_name = 'topic'
  ) THEN
    ALTER TABLE "VideoCallRoom" ADD COLUMN "topic" TEXT;
  END IF;
END $$;
