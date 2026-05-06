-- CreateEnum
CREATE TYPE "RoadmapNodeAccessType" AS ENUM ('STUDENTS', 'SELECTED', 'PURCHASE');

-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN     "nodeAccessType" "RoadmapNodeAccessType";
