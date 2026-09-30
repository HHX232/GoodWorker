'use client'

// Wallet build: every /api/lecture/* call may answer 402 INSUFFICIENT_BALANCE
// (recording a new minute, any AI call). The lecture page watches its own
// fetches (watchLectureBalance), stops the recording and opens one
// LectureBalanceModal ("top up to go on", or — once per VIP account — "we
// gave you $1 to finish"); the place that made the call just stops quietly
// (isBalanceError) instead of showing its own "failed" message on top.

export const LECTURE_BALANCE_EVENT = 'lecture:insufficient-balance'

export interface BalanceShortfall {
  neededCents: number
  availableCents: number
  /** The one-time VIP gift that this very 402 just credited (0 = none). */
  giftCents: number
  /** The recording was running when this 402 came back (read before anyone could stop it). */
  wasRecording: boolean
}

export const isBalanceError = (e: unknown) => e instanceof Error && e.message === 'INSUFFICIENT_BALANCE'

/** Wraps window.fetch while the lecture page is open; returns the undo. */
export function watchLectureBalance(isRecording: () => boolean): () => void {
  const original = window.fetch
  const wrapped: typeof window.fetch = async (input, init) => {
    const res = await original(input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (res.status === 402 && url.includes('/api/lecture/')) {
      // Now, before the caller sees the 402: the chunk queue stops the recorder itself.
      const wasRecording = isRecording()
      res.clone().json().then((data: { error?: string } & Partial<BalanceShortfall>) => {
        if (data?.error !== 'INSUFFICIENT_BALANCE') return
        window.dispatchEvent(new CustomEvent<BalanceShortfall>(LECTURE_BALANCE_EVENT, { detail: { neededCents: data.neededCents ?? 0, availableCents: data.availableCents ?? 0, giftCents: data.giftCents ?? 0, wasRecording } }))
      }).catch(() => {})
    }
    return res
  }
  window.fetch = wrapped
  return () => { if (window.fetch === wrapped) window.fetch = original }
}
