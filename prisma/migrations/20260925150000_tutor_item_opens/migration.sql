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

-- AddForeignKey
ALTER TABLE "TutorFolderOpen" ADD CONSTRAINT "TutorFolderOpen_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFolderOpen" ADD CONSTRAINT "TutorFolderOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileOpen" ADD CONSTRAINT "TutorFileOpen_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "TutorFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorFileOpen" ADD CONSTRAINT "TutorFileOpen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

