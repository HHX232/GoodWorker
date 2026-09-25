// The ONE place the storage feature touches the Wallet. Everything else asks
// this adapter, so the Wallet-free build (main) swaps only this file (plus the
// cron route and the admin price field) — see .autopilot/tutor-files/interfaces.md.
import { getWalletPricingSettings } from '@/shared/lib/wallet/wallet'

/** Wallet build: going over the quota is allowed and billed monthly. Wallet-free build: the quota is a hard cap. */
export const STORAGE_BILLING_ENABLED = true

export interface StoragePricing {
  priceCentsPerGbMonth: number
  usdToBynRate: number
}

export async function getStoragePricing(): Promise<StoragePricing | null> {
  const { storageOveragePriceCentsPerGbMonth, usdToBynRate } = await getWalletPricingSettings()
  return { priceCentsPerGbMonth: storageOveragePriceCentsPerGbMonth, usdToBynRate }
}

/** Admin: the monthly price per GB over the quota (stored in WalletSettings). */
export async function setStoragePrice(priceCentsPerGbMonth: number): Promise<void> {
  const { prisma } = await import('@/shared/prisma/prisma')
  await prisma.walletSettings.upsert({
    where: { id: 'global' },
    update: { storageOveragePriceCentsPerGbMonth: priceCentsPerGbMonth },
    create: { id: 'global', storageOveragePriceCentsPerGbMonth: priceCentsPerGbMonth },
  })
}
