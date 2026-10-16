'use client'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { SKINS, DEFAULT_SKIN, type SkinId } from './index'

/** Skin choice shared by every board on the site (`localStorage['gw-chess-skin']`). */
export function useChessSkin(): [SkinId, (id: SkinId) => void] {
  const [v, set] = useLocalPref('gw-chess-skin', DEFAULT_SKIN)
  const id = (SKINS.some((s) => s.id === v) ? v : DEFAULT_SKIN) as SkinId
  return [id, set]
}
