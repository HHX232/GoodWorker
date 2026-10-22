-- AlterTable
ALTER TABLE "LectureChunk" ADD COLUMN     "audioData" BYTEA,
ADD COLUMN     "audioMime" TEXT NOT NULL DEFAULT 'audio/webm';
