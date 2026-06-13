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
