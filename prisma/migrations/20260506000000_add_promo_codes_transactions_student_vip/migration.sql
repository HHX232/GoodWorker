-- Student VIP fields
ALTER TABLE "Student" ADD COLUMN "isVip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "vipExpiresAt" TIMESTAMP(3);

-- Enums
CREATE TYPE "PromoRewardType" AS ENUM ('FREE_VIP', 'DISCOUNT');
CREATE TYPE "TransactionType" AS ENUM ('VIP_PURCHASE', 'VIP_PROMO', 'DEPOSIT');

-- PromoCode table
CREATE TABLE "PromoCode" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "rewardType"      "PromoRewardType" NOT NULL,
    "discountPercent" INTEGER,
    "vipDays"         INTEGER NOT NULL DEFAULT 30,
    "description"     TEXT NOT NULL,
    "maxUses"         INTEGER,
    "usedCount"       INTEGER NOT NULL DEFAULT 0,
    "expiresAt"       TIMESTAMP(3),
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- VipTransaction table
CREATE TABLE "VipTransaction" (
    "id"              TEXT NOT NULL,
    "teacherId"       TEXT,
    "studentId"       TEXT,
    "userRole"        "Role" NOT NULL,
    "type"            "TransactionType" NOT NULL,
    "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description"     TEXT NOT NULL,
    "promoCodeId"     TEXT,
    "vipGrantedUntil" TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VipTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VipTransaction_teacherId_idx" ON "VipTransaction"("teacherId");
CREATE INDEX "VipTransaction_studentId_idx" ON "VipTransaction"("studentId");

ALTER TABLE "VipTransaction" ADD CONSTRAINT "VipTransaction_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VipTransaction" ADD CONSTRAINT "VipTransaction_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VipTransaction" ADD CONSTRAINT "VipTransaction_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed example promo codes
INSERT INTO "PromoCode" ("id", "code", "rewardType", "vipDays", "description", "maxUses", "isActive")
VALUES
    (gen_random_uuid()::text, 'FREEVIP30', 'FREE_VIP', 30, 'Бесплатный VIP на 30 дней', NULL, true),
    (gen_random_uuid()::text, 'FREEVIP7',  'FREE_VIP', 7,  'Бесплатный VIP на 7 дней',  100,  true);

INSERT INTO "PromoCode" ("id", "code", "rewardType", "discountPercent", "vipDays", "description", "maxUses", "isActive")
VALUES
    (gen_random_uuid()::text, 'HALF50', 'DISCOUNT', 50, 30, 'Скидка 50% на VIP (30 дней)', 200, true),
    (gen_random_uuid()::text, 'SALE20', 'DISCOUNT', 20, 30, 'Скидка 20% на VIP (30 дней)', NULL, true);
