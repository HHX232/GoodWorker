// The ONE place the storage feature would touch a Wallet. This build has no
// Wallet: storage is part of VIP and the quota (admin-set, 15 GB by default)
// is a hard cap — uploads past it are refused with 413 QUOTA_EXCEEDED.
// The Wallet build swaps only this file (plus a monthly cron route and the
// admin price field) — see .autopilot/tutor-files/interfaces.md.

/** Wallet build: going over the quota is allowed and billed monthly. This build: the quota is a hard cap. */
export const STORAGE_BILLING_ENABLED = false

export interface StoragePricing {
  priceCentsPerGbMonth: number
  usdToBynRate: number
}

export async function getStoragePricing(): Promise<StoragePricing | null> {
  return null
}

/** No overage price without a Wallet — the admin route never calls this while billing is off. */
export async function setStoragePrice(_priceCentsPerGbMonth: number): Promise<void> {
  throw new Error('Storage overage billing is not available in this build')
}
