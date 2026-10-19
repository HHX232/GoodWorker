'use client'
import { migrateSkinPref, useLocalPref } from '@/shared/lib/chess/localPref'
import { SKINS, DEFAULT_SKIN, type SkinId } from './index'

// once per page load, before any board reads its keys
if (typeof window !== 'undefined') {
  try {
    migrateSkinPref(localStorage)
  } catch {} // storage blocked: defaults apply, nothing to migrate
}

/** Board colours and piece set are chosen apart; every board on the site follows (`gw-chess-board` / `gw-chess-pieces`). */
function useSkinPref(key: string): [SkinId, (id: SkinId) => void] {
  const [v, set] = useLocalPref(key, DEFAULT_SKIN)
  const id = (SKINS.some((s) => s.id === v) ? v : DEFAULT_SKIN) as SkinId
  return [id, set]
}

export const useBoardTheme = () => useSkinPref('gw-chess-board')
export const usePieceSet = () => useSkinPref('gw-chess-pieces')
