-- AlterTable: add bio, coverPhotoUrl, socialLinks to Teacher
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "coverPhotoUrl" TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB;

-- CreateTable: AdminEmail
CREATE TABLE IF NOT EXISTS "AdminEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AdminEmail.email unique
CREATE UNIQUE INDEX IF NOT EXISTS "AdminEmail_email_key" ON "AdminEmail"("email");
