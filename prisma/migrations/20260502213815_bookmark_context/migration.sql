/*
  Warnings:

  - You are about to drop the column `xpath` on the `Bookmark` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bookmark" DROP COLUMN "xpath",
ADD COLUMN     "contextText" TEXT NOT NULL DEFAULT '';
