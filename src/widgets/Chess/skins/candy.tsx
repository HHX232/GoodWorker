import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'
import { sweets } from './boards'

// Candy (G37): desserts on a sugar plate — soft lumpy outlines, dripping icing, sprinkles, one cherry red.
// White = pastel strawberry, mint and cream; black = dark and milk chocolate with caramel.
type Ink = { main: string; alt: string; cream: string; cookie: string; caramel: string; accent: string; line: string }
const WHITE: Ink = { main: '#ffc9da', alt: '#bfeee0', cream: '#fff8ee', cookie: '#efc08a', caramel: '#f2b45a', accent: '#ef4f6f', line: '#7c3a4d' }
const BLACK: Ink = { main: '#6e3f27', alt: '#9b6440', cream: '#d9a35e', cookie: '#5c3520', caramel: '#e0a24a', accent: '#c82a46', line: '#24110a' }

const plate = (ink: Ink) => <path d="M23 85c0 4 12 6 27 6s27-2 27-6-12-5-27-5-27 1-27 5z" fill={ink.alt} />

/** Icing edge from x0 to x1 at y: a band 4 high whose bottom hangs in `n` scallops, alternately long and short. */
const drip = (x0: number, x1: number, y: number, n: number) => {
  const w = (x1 - x0) / n
  let d = `M${x0} ${y}H${x1}v4`
  for (let i = 0; i < n; i++) d += `q${-w / 2} ${i % 2 ? 6 : 11} ${-w} 0`
  return d + 'z'
}

const sprinkles = (ink: Ink, d: string) => <path d={d} fill="none" stroke={ink.accent} strokeWidth="2.2" />

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  // pawn: a lollipop with a swirl and a bow on its stick
  P: (ink) => (
    <>
      {plate(ink)}
      <rect x="47.5" y="56" width="5" height="28" rx="2" fill={ink.cream} />
      <circle cx="50" cy="44" r="16" fill={ink.main} />
      <path d="M50 44c0-3 4-3 4 0 0 5-8 5-8 0 0-7 12-7 12 0 0 9-16 9-16 0 0-11 20-11 20 0" fill="none" stroke={ink.cream} strokeWidth="2.6" />
      <path d="M50 64l-8-4.5v9zM50 64l8-4.5v9z" fill={ink.accent} strokeWidth="2" />
    </>
  ),
  // rook: a marshmallow castle — frosted battlements over a layered cake with a jam stripe
  R: (ink) => (
    <>
      {plate(ink)}
      <path d="M32 84V46h36v38z" fill={ink.main} />
      <path d="M32 64h36v6H32z" fill={ink.alt} />
      <path d="M28 46V22h10v8h7v-8h10v8h7v-8h10v24z" fill={ink.cream} />
      <path d={drip(28, 72, 44, 6)} fill={ink.cream} />
      {sprinkles(ink, 'M39 59l3-1.5M56 58l3 1.5M46 78l3-1M60 77l2.5 1.5')}
    </>
  ),
  // bishop: a cupcake — pleated wrapper, swirled frosting rising to a point, a candy pearl on top
  B: (ink) => (
    <>
      {plate(ink)}
      <path d="M33 84l-4-25h42l-4 25z" fill={ink.alt} />
      <path d="M39 61l2 22M46 61l1 22M54 61l-1 22M61 61l-2 22" fill="none" strokeWidth="1.8" />
      <path d="M28 60c-2-6 2-10 8-10-2-6 3-11 9-10 0-7 3-14 5-22 2 8 5 15 5 22 6-1 11 4 9 10 6 0 10 4 8 10z" fill={ink.main} />
      <path d="M36 50c6 3 22 3 28 0M43 40c4 2 10 2 14 0" fill="none" strokeWidth="2" />
      <circle cx="50" cy="15" r="3.6" fill={ink.cream} />
      {sprinkles(ink, 'M40 55l2.5-1.5M58 54l2.5 1.5M48 46l2.5 1')}
    </>
  ),
  // knight: a gingerbread horse with piped icing, a gumdrop eye and candy buttons
  N: (ink) => (
    <>
      {plate(ink)}
      <path d="M32 84c0-12 4-20 10-26-6 2-13 2-18-1-4-3-4-8-1-12l12-14c3-5 6-10 8-16l6 6c13 0 23 11 25 26 2 12 0 25-2 37z" fill={ink.cookie} />
      <path d="M51 25c8 2 14 9 17 18" fill="none" stroke={ink.cream} strokeWidth="3" />
      <path d="M40 70l4-4 4 4 4-4 4 4 4-4 4 4" fill="none" stroke={ink.cream} strokeWidth="2.6" />
      <path d="M27 52.5c3 2 6 2 8 0" fill="none" stroke={ink.cream} strokeWidth="2.4" />
      <circle cx="41" cy="35" r="4.2" fill={ink.cream} />
      <circle cx="40.5" cy="35.5" r="2.1" fill={ink.line} stroke="none" />
      <circle cx="28" cy="47" r="1.6" fill={ink.line} stroke="none" />
      <circle cx="58" cy="54" r="3.2" fill={ink.alt} />
      <circle cx="62" cy="63" r="3.2" fill={ink.accent} />
    </>
  ),
  // queen: an ice-cream cone, two scoops, a wafer crown and a cherry as its jewel
  Q: (ink) => (
    <>
      {plate(ink)}
      <path d="M37 54l13 32 13-32z" fill={ink.cookie} />
      <path d="M42 60l10 10M47 56l11 11M58 60l-10 10M53 56l-11 11" fill="none" strokeWidth="1.6" />
      <path d="M34 56c-3-10 4-18 16-18s19 8 16 18c-3 2-5-1-8 1s-5-2-8 0-5-2-8 0-5-3-8-1z" fill={ink.alt} />
      <path d="M38 40c-2-9 4-15 12-15s14 6 12 15c-4 1-8-1-12 0s-8-1-12 0z" fill={ink.main} />
      <path d="M40 28l-1-10 6 5 5-8 5 8 6-5-1 10z" fill={ink.caramel} />
      <path d="M50 10c1-3 3-4 6-5" fill="none" strokeWidth="2" />
      <circle cx="50" cy="14" r="4.5" fill={ink.accent} />
      {sprinkles(ink, 'M42 48l2.5-1.5M56 47l2.5 1.5M46 33l2-1.5')}
    </>
  ),
  // king: a two-tier cake with dripping icing, berries, and a caramel crown with a cross
  K: (ink) => (
    <>
      {plate(ink)}
      <path d="M24 84V62h52v22z" fill={ink.main} />
      <path d={drip(24, 76, 62, 8)} fill={ink.cream} />
      <circle cx="38" cy="76" r="3" fill={ink.accent} />
      <circle cx="50" cy="76" r="3" fill={ink.accent} />
      <circle cx="62" cy="76" r="3" fill={ink.accent} />
      <path d="M32 62V44h36v18z" fill={ink.alt} />
      <path d={drip(32, 68, 44, 6)} fill={ink.cream} />
      <path d="M36 44l-2-17 8 7 8-11 8 11 8-7-2 17z" fill={ink.caramel} />
      <path d="M48 23v-5h-4v-4h4V9h4v5h4v4h-4v5z" fill={ink.caramel} />
    </>
  ),
}

const draw = (kind: string, ink: Ink) => (
  <g stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
    {SHAPES[kind](ink)}
  </g>
)

export const candy: SkinDef = {
  id: 'candy',
  labelKey: 'skin_candy',
  only: 'pieces',
  pair: 'sweets',
  light: sweets.light,
  dark: sweets.dark,
  coordLight: sweets.coordLight,
  coordDark: sweets.coordDark,
  frame: sweets.frame,
  pieces: buildPieces('Candy', WHITE, BLACK, draw),
}
