-- CreateTable
CREATE TABLE "WalletSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "markupPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletSettings_pkey" PRIMARY KEY ("id")
);
