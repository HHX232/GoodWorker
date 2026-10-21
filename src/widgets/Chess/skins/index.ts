import { bordo } from './bordo'
import { crypt, emerald, fjord, graphite, ice, lair, sunset, sweets } from './boards'
import { candy } from './candy'
import { monsters } from './monsters'
import { vikings } from './vikings'
import { gold } from './gold'
import { grim } from './grim'
import { marble } from './marble'
import { neon } from './neon'
import { nightgrid } from './nightgrid'
import { classic } from './classic'
import { night } from './night'
import { powder } from './powder'
import { vintage } from './vintage'
import { wireframe } from './wireframe'
import type { SkinDef, SkinId } from './types'

export type { PieceCode, SkinDef, SkinId } from './types'

export const SKINS: SkinDef[] = [classic, vintage, night, bordo, powder, wireframe,
  monsters, vikings, candy, lair, fjord, sweets, grim, crypt,
  gold, marble, neon, nightgrid, ice, emerald, sunset, graphite]
export const BOARD_SKINS = SKINS.filter((s) => s.only !== 'pieces')
export const PIECE_SKINS = SKINS.filter((s) => s.only !== 'board')

export const DEFAULT_SKIN: SkinId = 'classic'

export const getSkin = (id: SkinId | undefined): SkinDef => SKINS.find((s) => s.id === id) ?? classic

/** A reward opens with its badge (codes from GET /api/chess/profile/me); `badges` null = guest — every reward closed. */
export const skinOpen = (s: SkinDef, badges: readonly string[] | null) => !s.unlock || !!badges?.includes(s.unlock)
