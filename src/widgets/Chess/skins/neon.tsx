import { buildPieces, type SkinDef } from './types'
import { SHAPES } from './night'
import { classic } from './classic'

// Neon (reward, storm_20): the flat Night silhouettes as lit tubes — a wide soft glow under a thin bright line.
// White glows ice-cyan on a pale core, black glows magenta on a near-black core: the sides never mix up.
type Ink = { core: string; tube: string; glow: string }
const WHITE: Ink = { core: '#eafcff', tube: '#00a9c7', glow: 'rgba(0, 200, 235, 0.38)' }
const BLACK: Ink = { core: '#1b0d24', tube: '#ff3fbf', glow: 'rgba(255, 63, 191, 0.4)' }

const shape = (kind: string, ink: Ink) => SHAPES[kind]({ fill: '', line: '', lineWidth: 0, cut: ink.tube })

const draw = (kind: string, ink: Ink) => (
  <g fill={ink.core} stroke={ink.tube} strokeWidth="2.4" strokeLinejoin="round">
    <g fill="none" stroke={ink.glow} strokeWidth="7">{shape(kind, ink)}</g>
    {shape(kind, ink)}
  </g>
)

export const neon: SkinDef = {
  id: 'neon',
  labelKey: 'skin_neon',
  only: 'pieces',
  unlock: 'storm_20',
  light: classic.light,
  dark: classic.dark,
  coordLight: classic.coordLight,
  coordDark: classic.coordDark,
  pieces: buildPieces('Neon', WHITE, BLACK, draw),
}
