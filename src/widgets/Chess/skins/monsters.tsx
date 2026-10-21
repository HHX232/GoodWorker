import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'
import { lair } from './boards'

// Monsters (G37): round cartoon creatures with one dark ink outline, big eyes and little fangs, all standing
// in a puddle of their second colour. White = mint with lilac, black = violet with swamp green and glowing eyes.
type Ink = { body: string; alt: string; light: string; line: string; crown: string }
const WHITE: Ink = { body: '#bfeadb', alt: '#cdb8ef', light: '#fffdf6', line: '#2a2138', crown: '#f3c44f' }
const BLACK: Ink = { body: '#4a2b63', alt: '#5f6b2a', light: '#eef3a0', line: '#120b18', crown: '#c9952e' }

const puddle = (ink: Ink) => <ellipse cx="50" cy="88" rx="27" ry="5" fill={ink.alt} />

const eye = (ink: Ink, x: number, y: number, r: number) => (
  <>
    <circle cx={x} cy={y} r={r} fill={ink.light} />
    <circle cx={x + r * 0.15} cy={y + r * 0.2} r={r * 0.52} fill={ink.line} stroke="none" />
    <circle cx={x + r * 0.32} cy={y - r * 0.05} r={r * 0.17} fill="#fff" stroke="none" />
  </>
)

// a small downward fang hung from a mouth line at (x, y)
const fang = (ink: Ink, x: number, y: number) => <path d={`M${x} ${y}l2 4.5 2-4.5z`} fill={ink.light} strokeWidth="1.6" />

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  // pawn: a little slime with a curl on top
  P: (ink) => (
    <>
      {puddle(ink)}
      <path d="M28 88C27 74 33 58 44 52c2-5 1-8-1-10 6 0 9 4 9 9 10 2 18 14 19 37Z" fill={ink.body} />
      <ellipse cx="34.5" cy="70" rx="2" ry="5" fill={ink.light} stroke="none" opacity="0.55" />
      {eye(ink, 43, 67, 6)}
      {eye(ink, 57, 67, 6)}
      <path d="M43 79c4 3 10 3 14 0" fill="none" />
      {fang(ink, 46, 80.2)}
    </>
  ),
  // rook: a stone golem whose head is a battlement, moss on top, stubby fists
  R: (ink) => (
    <>
      {puddle(ink)}
      <rect x="20" y="58" width="9" height="15" rx="3" fill={ink.body} />
      <rect x="71" y="58" width="9" height="15" rx="3" fill={ink.body} />
      <path d="M27 88V40h8v-8h9v8h12v-8h9v8h8v48Z" fill={ink.body} />
      <path d="M27 40h8v-8h9v8h12v-8h9v8h8v5c-4 3-8-2-12 1s-9-2-13 1-9-3-13 0-5-1-8-1z" fill={ink.alt} />
      <path d="M33 52h14M53 52h14" fill="none" />
      <rect x="35" y="55" width="10" height="6" rx="2" fill={ink.light} />
      <rect x="55" y="55" width="10" height="6" rx="2" fill={ink.light} />
      <path d="M38 72h24" fill="none" />
      {fang(ink, 41, 72)}
      {fang(ink, 55, 72)}
      <path d="M66 63l-4 5 3 4M33 77l4 3" fill="none" strokeWidth="1.8" />
    </>
  ),
  // bishop: a tall one-eyed cyclops with a horn for a mitre knob
  B: (ink) => (
    <>
      {puddle(ink)}
      <path d="M45 24c0-7 2-12 5-16 3 4 5 9 5 16z" fill={ink.alt} />
      <path d="M31 88C29 66 34 38 50 21C66 38 71 66 69 88Z" fill={ink.body} />
      {eye(ink, 50, 48, 10)}
      <path d="M38 40c6-6 18-6 24 0" fill="none" />
      <path d="M40 68c5 7 15 7 20 0z" fill={ink.line} />
      {fang(ink, 43, 68.4)}
      {fang(ink, 53, 68.4)}
    </>
  ),
  // knight: a horned beast in profile, snout left, spiky mane down its back
  N: (ink) => (
    <>
      {puddle(ink)}
      <path d="M71 32l9 3-5 6 8 4-7 5 7 6-8 3-1 10-4-36z" fill={ink.alt} />
      <path d="M62 27c2-8 8-13 15-13-4 4-6 9-6 15z" fill={ink.light} />
      <path d="M34 88c0-12 3-20 9-27-7 2-15 2-20-2-4-3-4-8-1-12l13-15c3-4 7-8 12-10 14-3 28 8 30 26 2 13 0 27-3 40Z" fill={ink.body} />
      <path d="M48 24c-2-8 1-14 8-18-2 6-1 11 2 17z" fill={ink.light} />
      {eye(ink, 46, 36, 6)}
      <circle cx="27" cy="48" r="1.6" fill={ink.line} stroke="none" />
      <path d="M23 56c5 2 11 2 16-1" fill="none" />
      {fang(ink, 27, 57)}
      {fang(ink, 33, 56.6)}
    </>
  ),
  // queen: a monster-queen crowned with three curling tentacles and a gold pearl
  Q: (ink) => (
    <>
      {puddle(ink)}
      <path d="M38 52C32 44 28 36 31 28c2-5 9-5 9 0-1 3-4 3-4 0-1 7 4 15 10 22z" fill={ink.alt} />
      <path d="M62 52C68 44 72 36 69 28c-2-5-9-5-9 0 1 3 4 3 4 0 1 7-4 15-10 22z" fill={ink.alt} />
      <path d="M44 50c-2-11-1-22 6-31 7 9 8 20 6 31z" fill={ink.alt} />
      <circle cx="50" cy="15" r="4.5" fill={ink.crown} />
      <path d="M30 88C28 68 34 50 50 48C66 50 72 68 70 88Z" fill={ink.body} />
      <circle cx="33.5" cy="36" r="1.3" fill={ink.light} stroke="none" />
      <circle cx="66.5" cy="36" r="1.3" fill={ink.light} stroke="none" />
      <circle cx="50" cy="30" r="1.3" fill={ink.light} stroke="none" />
      <path d="M37 59l-3-3M41 57l-1-4M63 59l3-3M59 57l1-4" fill="none" strokeWidth="2" />
      {eye(ink, 43, 64, 5.5)}
      {eye(ink, 57, 64, 5.5)}
      <path d="M43 76c4 3 10 3 14 0" fill="none" />
      {fang(ink, 44.5, 77.3)}
      {fang(ink, 51.5, 77.3)}
    </>
  ),
  // king: the big one — side horns, heavy brows, wide toothy grin, gold crown with a cross
  K: (ink) => (
    <>
      {puddle(ink)}
      <path d="M31 56c-7-4-10-11-8-18 4 4 8 6 12 7z" fill={ink.light} />
      <path d="M69 56c7-4 10-11 8-18-4 4-8 6-12 7z" fill={ink.light} />
      <path d="M25 88C23 64 31 43 50 41C69 43 77 64 75 88Z" fill={ink.body} />
      <path d="M48 22v-6h-4v-4h4V6h4v6h4v4h-4v6z" fill={ink.crown} />
      <path d="M36 45l-2-20 9 8 7-12 7 12 9-8-2 20z" fill={ink.crown} />
      {eye(ink, 42, 59, 6)}
      {eye(ink, 58, 59, 6)}
      <path d="M34 50l12 3M66 50l-12 3" fill="none" strokeWidth="3.2" />
      <path d="M35 70c6 10 24 10 30 0z" fill={ink.line} />
      <path d="M39 71l2.5 4.5 2.5-4.5M56 71l2.5 4.5 2.5-4.5" fill={ink.light} strokeWidth="1.6" />
    </>
  ),
}

const draw = (kind: string, ink: Ink) => (
  <g stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
    {SHAPES[kind](ink)}
  </g>
)

export const monsters: SkinDef = {
  id: 'monsters',
  labelKey: 'skin_monsters',
  only: 'pieces',
  pair: 'lair',
  light: lair.light,
  dark: lair.dark,
  coordLight: lair.coordLight,
  coordDark: lair.coordDark,
  frame: lair.frame,
  pieces: buildPieces('Monsters', WHITE, BLACK, draw),
}
