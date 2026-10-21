'use client'
import { migrateSkinPref, useLocalPref } from '@/shared/lib/chess/localPref'
import { useMyChessProgress } from '@/widgets/Chess/Progress'
import { BOARD_SKINS, PIECE_SKINS, DEFAULT_SKIN, skinOpen, type SkinDef, type SkinId } from './index'

// once per page load, before any board reads its keys
if (typeof window !== 'undefined') {
  try {
    migrateSkinPref(localStorage)
  } catch {} // storage blocked: defaults apply, nothing to migrate
}

/** Badge codes of the signed-in player; null = guest/unknown (rewards closed); 'loading' — not known yet. */
export function useMyBadges(): readonly string[] | null | 'loading' {
  const me = useMyChessProgress()
  if (me.status === 'loading') return 'loading'
  return me.status === 'ready' ? me.profile.badges.map((b) => b.code) : null
}

/** Board colours and piece set are chosen apart; every board on the site follows (`gw-chess-board` / `gw-chess-pieces`).
 *  A reward skin without its badge (old storage, hand-edited key, another account) falls back to classic. */
function useSkinPref(key: string, list: SkinDef[]): [SkinId, (id: SkinId) => void] {
  const [v, set] = useLocalPref(key, DEFAULT_SKIN)
  const badges = useMyBadges()
  const s = list.find((x) => x.id === v)
  // ponytail: while /me loads the stored reward shows as is — cosmetics, nothing to protect
  const id = s && (badges === 'loading' || skinOpen(s, badges)) ? s.id : DEFAULT_SKIN
  return [id, set]
}

export const useBoardTheme = () => useSkinPref('gw-chess-board', BOARD_SKINS)
export const usePieceSet = () => useSkinPref('gw-chess-pieces', PIECE_SKINS)
