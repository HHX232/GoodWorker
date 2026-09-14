-- AlterTable
ALTER TABLE "PaymentReminderSetting" ADD COLUMN     "lastRemindedUnpaidCount" INTEGER NOT NULL DEFAULT 0;
