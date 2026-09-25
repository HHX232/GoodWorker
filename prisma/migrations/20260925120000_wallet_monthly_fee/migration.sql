-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'MONTHLY_FEE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "vipFeePeriodStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "vipFeePeriodStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WalletSettings" ADD COLUMN     "monthlyFeeCents" INTEGER NOT NULL DEFAULT 500;
