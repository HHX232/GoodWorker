-- CreateTable
CREATE TABLE "StorageSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "quotaGb" INTEGER NOT NULL DEFAULT 15,
    "maxFileMb" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageSettings_pkey" PRIMARY KEY ("id")
);

