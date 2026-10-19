-- Chess progress, ревью T11: пояс фиксируется на сутки, дневной потолок очков за ботов, свой тип транзакции VIP за значок. Аддитивная.
ALTER TABLE "ChessProfile"
    ADD COLUMN IF NOT EXISTS "tzOffsetMin" INTEGER,
    ADD COLUMN IF NOT EXISTS "tzSetAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "pointsDay" TEXT,
    ADD COLUMN IF NOT EXISTS "pointsToday" INTEGER NOT NULL DEFAULT 0;

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CHESS_BADGE';
