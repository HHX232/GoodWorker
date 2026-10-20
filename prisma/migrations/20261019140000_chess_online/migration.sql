-- Chess online (T12): онлайн-партии и очередь подбора. Чисто аддитивная.
CREATE TABLE IF NOT EXISTS "ChessGame" (
    "id" TEXT NOT NULL,
    "whiteId" TEXT,
    "blackId" TEXT,
    "invitedId" TEXT,
    "initialFen" TEXT NOT NULL,
    "moves" TEXT NOT NULL DEFAULT '',
    "timeControl" TEXT NOT NULL,
    "whiteMs" INTEGER NOT NULL,
    "blackMs" INTEGER NOT NULL,
    "turnStartedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "result" TEXT,
    "termination" TEXT,
    "rated" BOOLEAN NOT NULL DEFAULT true,
    "drawOfferBy" TEXT,
    "rematchOf" TEXT,
    "whiteRating" INTEGER,
    "blackRating" INTEGER,
    "whiteDelta" INTEGER,
    "blackDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChessGame_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChessGame_whiteId_updatedAt_idx" ON "ChessGame"("whiteId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ChessGame_blackId_updatedAt_idx" ON "ChessGame"("blackId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ChessGame_invitedId_status_idx" ON "ChessGame"("invitedId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ChessGame_rematchOf_key" ON "ChessGame"("rematchOf");

CREATE TABLE IF NOT EXISTS "ChessSeek" (
    "userId" TEXT NOT NULL,
    "timeControl" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "gameId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChessSeek_pkey" PRIMARY KEY ("userId")
);
