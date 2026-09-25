-- CreateTable
CREATE TABLE "TutorFolderLink" (
    "token" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorFolderLink_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorFolderLink_folderId_key" ON "TutorFolderLink"("folderId");

-- AddForeignKey
ALTER TABLE "TutorFolderLink" ADD CONSTRAINT "TutorFolderLink_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TutorFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

