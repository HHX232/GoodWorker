-- AlterTable
ALTER TABLE "ServiceBooking" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentReminderSetting" (
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "everyNLessons" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReminderSetting_pkey" PRIMARY KEY ("teacherId","studentId")
);

-- AddForeignKey
ALTER TABLE "PaymentReminderSetting" ADD CONSTRAINT "PaymentReminderSetting_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminderSetting" ADD CONSTRAINT "PaymentReminderSetting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
