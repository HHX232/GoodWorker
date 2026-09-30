-- Wallet side of the storage over-limit billing only. The tutor-files tables
-- themselves are created by 20260925210000_tutor_files (main) — this branch's
-- earlier copy of them was dropped here when main was merged in, or deploy
-- would fail on "relation already exists".
-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'STORAGE_OVERAGE_DEBIT';

-- AlterTable
ALTER TABLE "WalletSettings" ADD COLUMN     "storageOveragePriceCentsPerGbMonth" INTEGER NOT NULL DEFAULT 0;
