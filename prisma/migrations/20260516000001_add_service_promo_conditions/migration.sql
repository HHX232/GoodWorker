-- "Service" and "ServiceBooking" were originally provisioned via `prisma db push` rather than
-- a migration, so they're missing from this history entirely — a database replaying migrations
-- from scratch (e.g. a fresh environment) fails here with "relation Service does not exist".
-- Create them defensively (matching the schema they were always meant to have) so both a fresh
-- database and one where they already exist end up in the same state.

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Service" (
    "id"                      TEXT NOT NULL,
    "teacherId"               TEXT NOT NULL,
    "title"                   TEXT NOT NULL,
    "description"             TEXT,
    "photoUrl"                TEXT,
    "categoryId"              TEXT,
    "duration"                INTEGER NOT NULL,
    "timeFrom"                TEXT NOT NULL,
    "timeTo"                  TEXT NOT NULL,
    "isGroup"                 BOOLEAN NOT NULL DEFAULT false,
    "price"                   DOUBLE PRECISION NOT NULL,
    "currency"                TEXT NOT NULL DEFAULT 'BYN',
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceBooking" (
    "id"          TEXT NOT NULL,
    "serviceId"   TEXT NOT NULL,
    "studentId"   TEXT NOT NULL,
    "status"      "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "promoCode"   TEXT,
    "finalPrice"  DOUBLE PRECISION NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceBooking_studentId_idx" ON "ServiceBooking"("studentId");
CREATE INDEX IF NOT EXISTS "ServiceBooking_serviceId_studentId_idx" ON "ServiceBooking"("serviceId", "studentId");

DO $$ BEGIN
  ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable ServicePromoCode if it doesn't exist
CREATE TABLE IF NOT EXISTS "ServicePromoCode" (
    "id"         TEXT NOT NULL,
    "serviceId"  TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "discount"   INTEGER NOT NULL,
    "usageLimit" INTEGER,
    "usedCount"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conditions" TEXT,
    CONSTRAINT "ServicePromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServicePromoCode_serviceId_code_key" ON "ServicePromoCode"("serviceId", "code");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServicePromoCode_serviceId_fkey'
  ) THEN
    ALTER TABLE "ServicePromoCode" ADD CONSTRAINT "ServicePromoCode_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add conditions column if table already existed without it
ALTER TABLE "ServicePromoCode" ADD COLUMN IF NOT EXISTS "conditions" TEXT;
