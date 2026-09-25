-- AlterTable
ALTER TABLE "WalletSettings" ADD COLUMN     "usdToBynRate" DOUBLE PRECISION NOT NULL DEFAULT 3.2,
ADD COLUMN     "vipBonusTiers" JSONB NOT NULL DEFAULT '[{"minAmountCents":500,"monthsPer500Cents":1},{"minAmountCents":2500,"monthsPer500Cents":1.1},{"minAmountCents":5000,"monthsPer500Cents":1.25},{"minAmountCents":10000,"monthsPer500Cents":1.5}]';
