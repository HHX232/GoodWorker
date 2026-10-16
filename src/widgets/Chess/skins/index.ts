import { classic } from './classic'
import type { SkinDef, SkinId } from './types'

export type { PieceCode, SkinDef, SkinId } from './types'

// ponytail: vintage/night/bordo/powder reuse classic until task 03 draws them (one file per skin).
const placeholder = (id: SkinId): SkinDef => ({ ...classic, id, labelKey: `skin_${id}` })

export const SKINS: SkinDef[] = [classic, placeholder('vintage'), placeholder('night'), placeholder('bordo'), placeholder('powder')]

export const DEFAULT_SKIN: SkinId = 'classic'

export const getSkin = (id: SkinId | undefined): SkinDef => SKINS.find((s) => s.id === id) ?? classic
