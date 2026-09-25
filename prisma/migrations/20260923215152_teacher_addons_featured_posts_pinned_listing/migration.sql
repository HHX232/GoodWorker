-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "pinnedInListUntil" TIMESTAMP(3),
ADD COLUMN     "postsHighlightedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WalletSettings" ADD COLUMN     "featuredPostsPriceCentsPerMonth" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "pinnedListingTiers" JSONB NOT NULL DEFAULT '[{"months":1,"priceCents":500},{"months":3,"priceCents":1200,"oldPriceCents":1500},{"months":6,"priceCents":2100,"oldPriceCents":3000},{"months":12,"priceCents":3600,"oldPriceCents":6000}]';
