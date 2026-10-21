-- Chess settings (T17): одна строка настроек наград (дни VIP за значки). Чисто аддитивная.
CREATE TABLE IF NOT EXISTS "ChessSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "vipRewards" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChessSettings_pkey" PRIMARY KEY ("id")
);
