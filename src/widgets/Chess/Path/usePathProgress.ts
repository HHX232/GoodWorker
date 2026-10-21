'use client'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { useMyChessProgress } from '@/widgets/Chess/Progress'

/** Guest steps live here (count of clean solves); a signed-in player's are ChessProfile.solved on the server. */
export const GUEST_PATH_KEY = 'gw-chess-path'

/** Steps passed on the puzzle path: server count for a player, localStorage for a guest; null while unknown. */
export function usePathProgress(): { solved: number | null; guest: boolean; addGuestStep: () => void } {
  const me = useMyChessProgress()
  const [raw, setRaw] = useLocalPref(GUEST_PATH_KEY, '0')
  const guestSolved = Math.max(0, Math.floor(Number(raw)) || 0)
  const guest = me.status === 'guest'
  return {
    solved: me.status === 'ready' ? me.profile.puzzlesSolved : guest || me.status === 'error' ? guestSolved : null,
    guest,
    addGuestStep: () => setRaw(String(guestSolved + 1)),
  }
}
