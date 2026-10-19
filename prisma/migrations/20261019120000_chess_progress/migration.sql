-- Chess progress (T11): серия, очки за ботов, онлайн-Эло, рекорды шторма, значки. Чисто аддитивная.
ALTER TABLE "ChessProfile"
    ADD COLUMN IF NOT EXISTS "botPoints" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "streakCurrent" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "streakBest" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastActiveDay" TEXT,
    ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 1200,
    ADD COLUMN IF NOT EXISTS "ratingGames" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "stormBest3" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "stormBest5" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ChessBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChessBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChessBadge_userId_code_key" ON "ChessBadge"("userId", "code");
