-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'LECTURE_DEBIT';

-- AlterTable
ALTER TABLE "LectureNote" ADD COLUMN     "chargedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargedMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LectureSettings" ADD COLUMN     "aiMarkupPercent" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "pricePerMinuteCents" DOUBLE PRECISION NOT NULL DEFAULT 1;
