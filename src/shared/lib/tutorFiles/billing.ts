import { prisma } from '@/shared/prisma/prisma'
import { getWalletPricingSettings } from '@/shared/lib/wallet/wallet'

// The ONE place the storage feature touches the Wallet. Wallet build: going
// over the quota (admin-set, 15 GB by default) is allowed — the monthly cron
// (app/api/cron/storage-overage-billing) debits price × GB over the quota from
// the tutor's balance. Admins (AdminEmail) stay capped by the quota.

/** Wallet build: going over the quota is allowed and billed monthly. */
export const STORAGE_BILLING_ENABLED = true

export interface StoragePricing {
  priceCentsPerGbMonth: number
  usdToBynRate: number
}

export async function getStoragePricing(): Promise<StoragePricing | null> {
  const s = await getWalletPricingSettings()
  return { priceCentsPerGbMonth: s.storageOveragePriceCentsPerGbMonth, usdToBynRate: s.usdToBynRate }
}

/** Admin → Хранилище: the over-limit price, kept in WalletSettings with the wallet's other prices. */
export async function setStoragePrice(priceCentsPerGbMonth: number): Promise<void> {
  const v = Math.max(0, Math.round(priceCentsPerGbMonth))
  await prisma.walletSettings.upsert({ where: { id: 'global' }, update: { storageOveragePriceCentsPerGbMonth: v }, create: { id: 'global', storageOveragePriceCentsPerGbMonth: v } })
}
