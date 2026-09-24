-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'STORAGE_OVERAGE_DEBIT';

-- AlterTable
ALTER TABLE "WalletSettings" ADD COLUMN     "storageOveragePriceCentsPerGbMonth" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TutorFolder" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "allowStudentUpload" BOOLEAN NOT NULL DEFAULT false,
    "restrictedToStudentId" TEXT,
    "ancestorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorFile" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByRole" "Role" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorFolderGrant" (
    "folderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFolderGrant_pkey" PRIMARY KEY ("folderId","studentId")
);

-- CreateTable
CREATE TABLE "TutorFileGrant" (
    "fileId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFileGrant_pkey" PRIMARY KEY ("fileId","studentId")
);

-- CreateIndex
CREATE INDEX "TutorFolder_teacherId_idx" ON "TutorFolder"("teacherId");

-- CreateIndex
CREATE INDEX "TutorFolder_parentId_idx" ON "TutorFolder"("parentId");

-- CreateIndex
CREATE INDEX "TutorFile_teacherId_idx" ON "TutorFile"("teacherId");

-- CreateIndex
CREATE INDEX "TutorFile_folderId_idx" ON "TutorFile"("folderId");

-- AddForeignKey
ALTER TABLE "TutorFolder" ADD CONSTRAINT "TutorFolder_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolder" ADD CONSTRAINT "TutorFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolder" ADD CONSTRAINT "TutorFolder_restrictedToStudentId_fkey" FOREIGN KEY ("restrictedToStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFile" ADD CONSTRAINT "TutorFile_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFile" ADD CONSTRAINT "TutorFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderGrant" ADD CONSTRAINT "TutorFolderGrant_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderGrant" ADD CONSTRAINT "TutorFolderGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileGrant" ADD CONSTRAINT "TutorFileGrant_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileGrant" ADD CONSTRAINT "TutorFileGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
