-- CreateTable
CREATE TABLE "TutorFolder" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "allowStudentUpload" BOOLEAN NOT NULL DEFAULT false,
    "cover" TEXT,
    "submissionDeadline" TIMESTAMP(3),
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
    "contentText" TEXT,

    CONSTRAINT "TutorFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorFolderGrant" (
    "folderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),

    CONSTRAINT "TutorFolderGrant_pkey" PRIMARY KEY ("folderId","studentId")
);

-- CreateTable
CREATE TABLE "StorageSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "quotaGb" INTEGER NOT NULL DEFAULT 15,
    "maxFileMb" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorFileReview" (
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "grade" TEXT,
    "comment" TEXT,
    "annotations" JSONB NOT NULL DEFAULT '[]',
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorFileReview_pkey" PRIMARY KEY ("fileId")
);

-- CreateTable
CREATE TABLE "TutorFolderLink" (
    "token" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFolderLink_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "TutorFolderOpen" (
    "folderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFolderOpen_pkey" PRIMARY KEY ("folderId","studentId")
);

-- CreateTable
CREATE TABLE "TutorFileOpen" (
    "fileId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFileOpen_pkey" PRIMARY KEY ("fileId","studentId")
);

-- CreateTable
CREATE TABLE "TutorFileGrant" (
    "fileId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),

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

-- CreateIndex
CREATE UNIQUE INDEX "TutorFolderLink_folderId_key" ON "TutorFolderLink"("folderId");

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
ALTER TABLE "TutorFileReview" ADD CONSTRAINT "TutorFileReview_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderLink" ADD CONSTRAINT "TutorFolderLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderOpen" ADD CONSTRAINT "TutorFolderOpen_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderOpen" ADD CONSTRAINT "TutorFolderOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileOpen" ADD CONSTRAINT "TutorFileOpen_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileOpen" ADD CONSTRAINT "TutorFileOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileGrant" ADD CONSTRAINT "TutorFileGrant_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileGrant" ADD CONSTRAINT "TutorFileGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

