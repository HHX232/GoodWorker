import { bordo } from './bordo'
import { classic } from './classic'
import { night } from './night'
import { powder } from './powder'
import { vintage } from './vintage'
import { wireframe } from './wireframe'
import type { SkinDef, SkinId } from './types'

export type { PieceCode, SkinDef, SkinId } from './types'

export const SKINS: SkinDef[] = [classic, vintage, night, bordo, powder, wireframe]

export const DEFAULT_SKIN: SkinId = 'classic'

export const getSkin = (id: SkinId | undefined): SkinDef => SKINS.find((s) => s.id === id) ?? classic
