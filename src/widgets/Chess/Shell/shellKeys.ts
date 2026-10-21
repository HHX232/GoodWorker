/** localStorage: single-key shortcuts on/off (the Settings modal), '1' by default */
export const HOTKEYS = 'gw-chess-hotkeys'

export type ShellAction = 'new' | 'puzzles' | 'search' | 'keys'

type KeyTarget = { tagName?: string; isContentEditable?: boolean } | null
type KeyInput = { key: string; code?: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: EventTarget | KeyTarget }

/**
 * A chess-section hotkey for this keydown, or null. Takes a KeyboardEvent as is.
 * Letters go by the physical key (`code`), so N/P work on the Russian layout too.
 */
export function shellKey(e: KeyInput): ShellAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const el = (e.target ?? null) as KeyTarget
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ''))) return null
  const key = e.key.toLowerCase()
  if (e.code === 'KeyN' || key === 'n') return 'new'
  if (e.code === 'KeyP' || key === 'p') return 'puzzles'
  if (key === '?' || (e.code === 'Slash' && e.shiftKey)) return 'keys'
  if (key === '/' || e.code === 'Slash') return 'search'
  return null
}
