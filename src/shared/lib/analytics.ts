declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

/** Push a custom event to GTM's dataLayer for a "Пользовательское событие" trigger. Safe to call from anywhere client-side — no-ops if dataLayer isn't there yet. */
export function pushDataLayerEvent(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  } catch {}
}
