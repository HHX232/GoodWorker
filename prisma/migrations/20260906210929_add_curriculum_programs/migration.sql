-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "schoolGrade" INTEGER;

-- CreateTable
CREATE TABLE "CurriculumProgram" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "gradeFrom" INTEGER NOT NULL,
    "gradeTo" INTEGER NOT NULL,
    "grade" INTEGER,
    "sourceFile" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "rawHash" TEXT NOT NULL,
    "summary" JSONB,
    "summarizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumProgram_subject_grade_idx" ON "CurriculumProgram"("subject", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumProgram_subject_scope_gradeFrom_gradeTo_grade_key" ON "CurriculumProgram"("subject", "scope", "gradeFrom", "gradeTo", "grade");
