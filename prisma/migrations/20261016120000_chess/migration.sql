-- Chess: puzzles (Lichess, CC0), attempts, puzzle rating profile; subject category "chess".

CREATE TABLE IF NOT EXISTS "ChessPuzzle" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "themes" TEXT[],
    "openingTags" TEXT[],
    "popularity" INTEGER NOT NULL,
    CONSTRAINT "ChessPuzzle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChessPuzzle_rating_idx" ON "ChessPuzzle"("rating");

CREATE TABLE IF NOT EXISTS "ChessPuzzleAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChessPuzzleAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChessPuzzleAttempt_userId_createdAt_idx" ON "ChessPuzzleAttempt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChessPuzzleAttempt_userId_puzzleId_idx" ON "ChessPuzzleAttempt"("userId", "puzzleId");

CREATE TABLE IF NOT EXISTS "ChessProfile" (
    "userId" TEXT NOT NULL,
    "puzzleRating" INTEGER NOT NULL DEFAULT 1200,
    "solved" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChessProfile_pkey" PRIMARY KEY ("userId")
);

INSERT INTO "Category" ("id", "slug", "levelNumber", "parentId")
VALUES (gen_random_uuid()::text, 'chess', 1, NULL)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CategoryTranslation" ("id", "categoryId", "langCode", "name")
SELECT gen_random_uuid()::text, c."id", t."langCode", t."name"
FROM "Category" c
CROSS JOIN (VALUES ('ru', 'Шахматы'), ('en', 'Chess'), ('hi', 'शतरंज'), ('zh', '国际象棋')) AS t("langCode", "name")
WHERE c."slug" = 'chess'
ON CONFLICT ("categoryId", "langCode") DO NOTHING;
