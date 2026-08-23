-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "referralCode" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerTeacherId" TEXT,
    "referrerStudentId" TEXT,
    "referrerRole" "Role" NOT NULL,
    "referredTeacherId" TEXT,
    "referredStudentId" TEXT,
    "referredRole" "Role" NOT NULL,
    "rewardDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "rewardDays" INTEGER NOT NULL DEFAULT 14,
    "maxFreeInvites" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredTeacherId_key" ON "Referral"("referredTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredStudentId_key" ON "Referral"("referredStudentId");

-- CreateIndex
CREATE INDEX "Referral_referrerTeacherId_idx" ON "Referral"("referrerTeacherId");

-- CreateIndex
CREATE INDEX "Referral_referrerStudentId_idx" ON "Referral"("referrerStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_referralCode_key" ON "Student"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_referralCode_key" ON "Teacher"("referralCode");

