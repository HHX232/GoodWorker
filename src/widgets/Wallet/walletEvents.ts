// Cross-component "balance just changed" signal — a plain DOM CustomEvent
// rather than a context/store: the only consumer is WalletBadge (header,
// mounted once, far from where purchases happen on /vip and /wallet), so a
// global store would be pure ceremony for one listener.
const WALLET_CHANGED_EVENT = 'wallet:changed'

export function notifyWalletChanged(): void {
  window.dispatchEvent(new Event(WALLET_CHANGED_EVENT))
}

export function onWalletChanged(handler: () => void): () => void {
  window.addEventListener(WALLET_CHANGED_EVENT, handler)
  return () => window.removeEventListener(WALLET_CHANGED_EVENT, handler)
}
