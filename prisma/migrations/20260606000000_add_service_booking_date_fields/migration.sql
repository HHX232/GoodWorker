-- Add date/time fields to ServiceBooking
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "desiredDate"    TEXT;
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "desiredTime"    TEXT;
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "confirmedDate"  TEXT;
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "confirmedTime"  TEXT;
