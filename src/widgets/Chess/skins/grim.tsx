import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'
import { crypt } from './boards'

// Grim («Кошмары», G38): the serious monsters — ghoul, bone horse, reaper, gargoyle tower, vampire, Cthulhu.
// Thick dark contour, each mass in three tones (lit edge left, shadow right, cut by two shared clip terminators),
// thin hatching in the shadow, glowing eyes. White = bone and parchment with toxic-green eyes;
// black = swamp green / obsidian with red eyes. One domed plinth for the whole set.
type Ink = { hi: string; mid: string; shade: string; line: string; eye: string }
const WHITE: Ink = { hi: '#f4f3e3', mid: '#d7d6b6', shade: '#a6a582', line: '#262b1f', eye: '#8fe03a' }
const BLACK: Ink = { hi: '#5f8f52', mid: '#3d6638', shade: '#233f25', line: '#0c140c', eye: '#ff3b2a' }

type Kit = { ink: Ink; vol: (d: string) => ReactNode }

const hatch = (ink: Ink, d: string) => <path d={d} fill="none" stroke={ink.line} strokeWidth="1.3" opacity="0.55" />

const plinth = ({ ink, vol }: Kit) => (
  <>
    {vol('M23 90v-5c0-5 4-9 10-10h34c6 1 10 5 10 10v5z')}
    <path d="M30 79.5h40" fill="none" stroke={ink.hi} strokeWidth="2" />
    <path d="M23 85h54" fill="none" strokeWidth="2" />
  </>
)

const SHAPES: Record<string, (k: Kit) => ReactNode> = {
  // pawn: a hunched ghoul — pointed ears, slanted eyes, a gaping maw of teeth, claws on the plinth
  P: (k) => (
    <>
      {plinth(k)}
      <path d="M38 50l-9-9 2 11zM62 50l9-9-2 11z" fill={k.ink.shade} />
      {k.vol('M32 76c-2-10 0-20 6-26 2-6 7-10 12-10s10 4 12 10c6 6 8 16 6 26z')}
      {hatch(k.ink, 'M62 56c2 4 3 9 2 14M58 70l2-6')}
      <path d="M40.5 46.5l6.5 2-5.5 2z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M59.5 46.5l-6.5 2 5.5 2z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M42 57c0-4 4-6 8-6s8 2 8 6v5c0 4-4 7-8 7s-8-3-8-7z" fill={k.ink.line} />
      <path d="M43 53.5l2 3.6 2-3.6 2 3.6 2-3.6 2 3.6 2-3.6 2 3.6 2-3.6" fill={k.ink.hi} strokeWidth="1.2" />
      <path d="M44 67l2-3.6 2 3.6 2-3.6 2 3.6 2-3.6 2 3.6" fill={k.ink.hi} strokeWidth="1.2" />
      <path d="M34 73l-3 5M38 74l-1 4.5M66 73l3 5M62 74l1 4.5" fill="none" strokeWidth="2.2" />
    </>
  ),
  // rook: a gargoyle tower — battlement crown, a carved snarling face, glowing runes, cracks
  R: (k) => (
    <>
      {plinth(k)}
      {k.vol('M29 75V32h-3V15h10v6h9v-6h10v6h9v-6h10v17h-3v43z')}
      <path d="M29 32h42M29 52h6M65 52h6M29 64h4M67 64h4" fill="none" strokeWidth="2" />
      {hatch(k.ink, 'M66 22v6M68 38l-3 4 2 4M66 58c-1 4-1 8 0 12')}
      <path d="M35 40l10 4.5M65 40l-10 4.5" fill="none" strokeWidth="3.2" />
      <path d="M37 44.5l7.5 2.5-6.5 2z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M63 44.5l-7.5 2.5 6.5 2z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M47.5 49l2.5 5 2.5-5" fill="none" strokeWidth="2" />
      <path d="M38 58c5 4 19 4 24 0v4c-5 4-19 4-24 0z" fill={k.ink.line} />
      <path d="M41 59l1.6 4.4 1.6-3.8M59 59l-1.6 4.4-1.6-3.8" fill={k.ink.hi} strokeWidth="1.3" />
      <path d="M41 68v6M41 70l3-2M59 68v6M59 71l-3-2M48 68l4 6M52 68l-4 6" fill="none" stroke={k.ink.eye} strokeWidth="1.8" />
    </>
  ),
  // bishop: the reaper — a tall pointed hood over a void, two burning eyes, robe folds, a scythe across the hood
  B: (k) => (
    <>
      {plinth(k)}
      <path d="M63 77l-4.5-56h3l4.5 56z" fill={k.ink.shade} />
      {k.vol('M30 77c1-14 4-26 9-34 2-12 6-22 11-31 5 9 9 19 11 31 5 8 8 20 9 34z')}
      <path d="M61 21c-9-7-22-7-31 1 9-2 18-1 27 5z" fill={k.ink.hi} />
      <path d="M41 41c0-8 4-14 9-14s9 6 9 14c0 5-4 9-9 9s-9-4-9-9z" fill={k.ink.line} />
      <circle cx="46.3" cy="38.5" r="2.3" fill={k.ink.eye} stroke="none" />
      <circle cx="53.7" cy="38.5" r="2.3" fill={k.ink.eye} stroke="none" />
      <path d="M44 53c-2 8-3 16-3 24M50 55v22" fill="none" strokeWidth="2" />
      {hatch(k.ink, 'M56 53c2 8 3 16 3 24M62 50c2 7 3 14 4 22M58 30c1 4 2 7 2 10')}
    </>
  ),
  // knight: a bone dragon-horse — skull snout with a row of teeth, burning socket, spined neck, a horn
  N: (k) => (
    <>
      {plinth(k)}
      <path d="M64 21l8-4-2 7 8-1-5 6 8 2-7 4 7 4-8 2 4 6-9-1z" fill={k.ink.shade} />
      <path d="M52 18c2-7 6-11 13-13-2 4-2 8 0 12z" fill={k.ink.hi} />
      {k.vol('M36 77c0-11 3-18 8-23-6 2-13 1-18-3-3-3-3-7 0-10l12-14c3-5 8-9 14-10 12-1 22 8 24 22 2 13 0 25-4 38z')}
      <path d="M41 31c3-4 9-3 10 1-2 3-8 4-10-1z" fill={k.ink.line} />
      <circle cx="46.5" cy="31.5" r="2" fill={k.ink.eye} stroke="none" />
      <path d="M27 39.5c1-1.5 3-1.5 3.5 0.5" fill="none" strokeWidth="2" />
      <path d="M24.5 45.5h15" fill="none" strokeWidth="2" />
      <path d="M26.5 45.5l1.5 3.4 1.5-3.4 1.5 3.4 1.5-3.4 1.5 3.4 1.5-3.4 1.5 3.4 1.5-3.4 1.5 3.4" fill={k.ink.hi} strokeWidth="1.2" />
      <path d="M46 39c4 2 8 6 9 12" fill="none" strokeWidth="2" />
      {hatch(k.ink, 'M57 52c4 0 8-1 11-3M55 60c4 0 9-1 12-3M54 68c4 0 9-1 12-3M66 28c3 3 5 7 6 11')}
    </>
  ),
  // queen: the vampire countess — a fanned high collar, widow's-peak hair, pointed ears, fangs, a spiked crown
  Q: (k) => (
    <>
      {plinth(k)}
      <path d="M27 33c4 10 8 19 13 27h20c5-8 9-17 13-27-8 3-13 8-16 15H43c-3-7-8-12-16-15z" fill={k.ink.shade} />
      {k.vol('M30 77c2-10 8-16 14-19h12c6 3 12 9 14 19z')}
      {hatch(k.ink, 'M60 64c2 3 4 7 5 11M56 66c1 3 2 6 2 9')}
      <circle cx="50" cy="62" r="3" fill={k.ink.eye} />
      <path d="M41.5 40l-6-6 4.5 10zM58.5 40l6-6-4.5 10z" fill={k.ink.mid} />
      {k.vol('M41 40c0-8 4-13 9-13s9 5 9 13c0 7-4 13-9 15-5-2-9-8-9-15z')}
      <path d="M40.5 38c0-9 4-14 9.5-14s9.5 5 9.5 14c-3-4-6-5-9.5-3-3.5-2-6.5-1-9.5 3z" fill={k.ink.line} />
      <path d="M42.5 40l5 2-4.5 1.4z" fill={k.ink.eye} strokeWidth="1.4" />
      <path d="M57.5 40l-5 2 4.5 1.4z" fill={k.ink.eye} strokeWidth="1.4" />
      <path d="M46 48c2 1 6 1 8 0" fill="none" strokeWidth="1.8" />
      <path d="M47 48.4l1 3.2 1-2.8M53 48.4l-1 3.2-1-2.8" fill={k.ink.hi} strokeWidth="1.1" />
      <path d="M40.5 25l-1-10 4.5 4 3-7 3 6 3-6 3 7 4.5-4-1 10z" fill={k.ink.hi} />
      <circle cx="50" cy="21" r="1.6" fill={k.ink.eye} stroke="none" />
    </>
  ),
  // king: Cthulhu — an octopus head with a ridged brow and slit eyes, spiked fins, a tentacle beard, crown and cross
  K: (k) => (
    <>
      {plinth(k)}
      <path d="M31 46l-11-6 4 8-8 2 9 4-6 6 12-3zM69 46l11-6-4 8 8 2-9 4 6 6-12-3z" fill={k.ink.shade} />
      {k.vol('M30 52c-2-16 8-27 20-27s22 11 20 27c-1 6-5 10-9 12H39c-4-2-8-6-9-12z')}
      {hatch(k.ink, 'M42 35c5-2 11-2 16 0M63 40c2 4 3 9 2 13')}
      <path d="M36 44c4-4 9-4 12 0M64 44c-4-4-9-4-12 0" fill="none" strokeWidth="3" />
      <path d="M38 49c3-3 8-3 10 1-3 2-7 2-10-1z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M62 49c-3-3-8-3-10 1 3 2 7 2 10-1z" fill={k.ink.eye} strokeWidth="1.6" />
      <path d="M43.3 47.3v4M56.7 47.3v4" fill="none" strokeWidth="1.6" />
      <path d="M36 60c-4 6-6 12-3 17 2 2 5 1 5-1-2 0-3-1-2-3 2-4 4-8 5-12zM64 60c4 6 6 12 3 17-2 2-5 1-5-1 2 0 3-1 2-3-2-4-4-8-5-12z" fill={k.ink.mid} />
      <path d="M43 62c-2 6-3 11 0 15 2 1 4 0 4-2-2 0-2-2-2-3 0-3 1-6 2-9zM57 62c2 6 3 11 0 15-2 1-4 0-4-2 2 0 2-2 2-3 0-3-1-6-2-9z" fill={k.ink.shade} />
      <path d="M48 62c-1 5-1 10 1 15h2c2-5 2-10 1-15z" fill={k.ink.mid} />
      <path d="M36 31l-1-12 7 6 4-9 4 7 4-7 4 9 7-6-1 12z" fill={k.ink.hi} />
      <circle cx="50" cy="27" r="1.8" fill={k.ink.eye} stroke="none" />
      <path d="M47.5 18v-4.5h-4.5V9h4.5V4.5h5V9h4.5v4.5h-4.5V18z" fill={k.ink.hi} />
    </>
  ),
}

// Shared light: everything right of a soft terminator is in shadow, a sliver on the left is lit.
const defs = (_ink: Ink, uid: string) => (
  <>
    <clipPath id={`${uid}s`}>
      <path d="M59 0C69 25 64 55 72 100H100V0Z" />
    </clipPath>
    <clipPath id={`${uid}h`}>
      <path d="M0 0H39C35 25 38 55 34 100H0Z" />
    </clipPath>
  </>
)

const draw = (kind: string, ink: Ink, _side: 'w' | 'b', uid: string) => {
  const vol = (d: string) => (
    <>
      <path d={d} fill={ink.mid} />
      <path d={d} fill={ink.shade} stroke="none" clipPath={`url(#${uid}s)`} />
      <path d={d} fill={ink.hi} stroke="none" clipPath={`url(#${uid}h)`} />
      <path d={d} fill="none" />
    </>
  )
  return (
    <g stroke={ink.line} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      {SHAPES[kind]({ ink, vol })}
    </g>
  )
}

export const grim: SkinDef = {
  id: 'grim',
  labelKey: 'skin_grim',
  only: 'pieces',
  pair: 'crypt',
  light: crypt.light,
  dark: crypt.dark,
  coordLight: crypt.coordLight,
  coordDark: crypt.coordDark,
  frame: crypt.frame,
  pieces: buildPieces('Grim', WHITE, BLACK, draw, defs),
}
