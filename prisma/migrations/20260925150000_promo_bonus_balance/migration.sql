-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'PROMO_BONUS';

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "bonusBalanceCents" INTEGER NOT NULL DEFAULT 0;
