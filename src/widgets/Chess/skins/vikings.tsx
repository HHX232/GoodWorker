import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'
import { fjord } from './boards'

// Vikings (G37): carved-toy figures on a plank — wood, metal, fur, painted shields. White = light ash and
// bronze with straw beards, black = tarred wood, dark iron, raven feathers and grey beards.
type Ink = { wood: string; metal: string; fur: string; skin: string; beard: string; bone: string; paint: string; crown: string; line: string }
const WHITE: Ink = {
  wood: '#e7c891', metal: '#c98f45', fur: '#f3ead6', skin: '#f2cba5', beard: '#e0b356', bone: '#fbf4e4', paint: '#b64a2c', crown: '#f0c24a', line: '#3b2615',
}
const BLACK: Ink = {
  wood: '#5a4436', metal: '#6c737b', fur: '#2c2d34', skin: '#c99a78', beard: '#8a8d95', bone: '#cfc6b2', paint: '#8e2b2b', crown: '#c79a34', line: '#0d0c0e',
}

const plank = (ink: Ink) => <path d="M24 84h52l3 6H21z" fill={ink.wood} />
const dot = (ink: Ink, x: number, y: number) => <circle cx={x} cy={y} r="1.7" fill={ink.line} stroke="none" />

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  // pawn: a helmeted warrior behind a big round painted shield
  P: (ink) => (
    <>
      {plank(ink)}
      <path d="M40 47h20v6c0 6-4 10-10 10s-10-4-10-10z" fill={ink.skin} />
      <path d="M42 57c2 6 14 6 16 0" fill={ink.beard} />
      {dot(ink, 44.5, 52)}
      {dot(ink, 55.5, 52)}
      <path d="M38 45c0-9 5-14 12-14s12 5 12 14z" fill={ink.metal} />
      <path d="M36.5 44h27v4h-27zM48 48h4v7h-4z" fill={ink.metal} />
      <circle cx="50" cy="71" r="17" fill={ink.wood} />
      <path d="M50 54a17 17 0 0 1 17 17H50zM50 88a17 17 0 0 1-17-17h17z" fill={ink.paint} />
      <circle cx="50" cy="71" r="4.5" fill={ink.metal} />
    </>
  ),
  // rook: a log watchtower — crenellated lookout, iron band, a shield and a dark door
  R: (ink) => (
    <>
      {plank(ink)}
      <path d="M32 86V46h-4V22h8v7h7v-7h14v7h7v-7h8v24h-4v40Z" fill={ink.wood} />
      <path d="M39 29v14M50 22v21M61 29v14M32 58h36M32 72h36" fill="none" strokeWidth="1.8" />
      <rect x="26" y="42" width="48" height="5" rx="1" fill={ink.metal} />
      <path d="M44 86V79a6 6 0 0 1 12 0v7" fill={ink.line} />
      <circle cx="50" cy="63" r="6" fill={ink.paint} />
      <circle cx="50" cy="63" r="1.8" fill={ink.metal} />
    </>
  ),
  // bishop: the skald-shaman — pointed fur hood with ram horns, long beard, a rune on the robe
  B: (ink) => (
    <>
      {plank(ink)}
      <path d="M31 85c1-16 5-28 11-36h16c6 8 10 20 11 36z" fill={ink.wood} />
      <path d="M50 60v18M50 65l5-4M50 71l-5-4" fill="none" strokeWidth="2.2" />
      <path d="M39 30c-8-1-13-7-12-15 3 5 7 7 13 8z" fill={ink.bone} />
      <path d="M61 30c8-1 13-7 12-15-3 5-7 7-13 8z" fill={ink.bone} />
      <path d="M37 52c-1-16 4-29 13-37 9 8 14 21 13 37z" fill={ink.fur} />
      <path d="M43 39c0-5 3-8 7-8s7 3 7 8v4c0 4-3 7-7 7s-7-3-7-7z" fill={ink.skin} />
      <path d="M44 46c0 7 3 12 6 15 3-3 6-8 6-15-2 2-10 2-12 0z" fill={ink.beard} />
      <path d="M45 39h3M52 39h3" fill="none" strokeWidth="2" />
    </>
  ),
  // knight: a carved dragon prow — open toothy jaw, fin crest, scales down the neck
  N: (ink) => (
    <>
      {plank(ink)}
      <path d="M53 21c2-6 6-10 12-12-1 4 0 7 2 10 3-3 7-4 11-3-3 3-4 7-3 11z" fill={ink.paint} />
      <path d="M40 86c-2-14 2-26 10-34-6 0-12-2-16-6l-8-2c-4-1-4-6 0-8l8-6c6-6 12-10 20-10 12 0 22 10 22 24 0 14-6 24-8 42z" fill={ink.wood} />
      <path d="M26 41h12" fill="none" />
      <path d="M28 41l2 3.5 2-3.5 2 3.5 2-3.5" fill={ink.bone} strokeWidth="1.5" />
      <circle cx="48" cy="31" r="4" fill={ink.bone} />
      <circle cx="47" cy="31.5" r="2" fill={ink.line} stroke="none" />
      <path d="M30 34c2-2 4-2 5 0" fill="none" strokeWidth="2" />
      <path d="M56 56c3 2 6 2 9 0M54 66c3 2 6 2 9 0M53 76c3 2 6 2 9 0" fill="none" strokeWidth="2" />
    </>
  ),
  // queen: a valkyrie — raven-feather winged helm, long braids, scale breastplate
  Q: (ink) => (
    <>
      {plank(ink)}
      <path d="M38 44c-3 10-3 22 0 32 3-2 4-6 3-10-2-8-1-16 1-22zM62 44c3 10 3 22 0 32-3-2-4-6-3-10 2-8 1-16-1-22z" fill={ink.beard} />
      <path d="M33 85c0-14 4-24 10-28h14c6 4 10 14 10 28z" fill={ink.metal} />
      <path d="M41 66c3 3 6 3 9 0 3 3 6 3 9 0M41 74c3 3 6 3 9 0 3 3 6 3 9 0" fill="none" strokeWidth="1.8" />
      <path d="M41 38c0-6 4-10 9-10s9 4 9 10v4c0 6-4 10-9 10s-9-4-9-10z" fill={ink.skin} />
      {dot(ink, 46, 41)}
      {dot(ink, 54, 41)}
      <path d="M47 46.5c2 1 4 1 6 0" fill="none" strokeWidth="1.8" />
      <path d="M40 34C33 33 26 24 25 10c4 3 8 4 12 3-2 3-1 6 2 8-1 3 0 6 3 7zM60 34c7-1 14-10 15-24-4 3-8 4-12 3 2 3 1 6-2 8 1 3 0 6-3 7z" fill={ink.fur} />
      <path d="M40 37c0-8 4-13 10-13s10 5 10 13z" fill={ink.metal} />
    </>
  ),
  // king: the jarl — big horned helm with a small gold crown, huge braided beard, fur cloak
  K: (ink) => (
    <>
      {plank(ink)}
      <path d="M27 85c0-16 6-28 15-32h16c9 4 15 16 15 32z" fill={ink.fur} />
      <circle cx="36" cy="64" r="3.5" fill={ink.metal} />
      <circle cx="64" cy="64" r="3.5" fill={ink.metal} />
      <path d="M40 36c0-6 4-10 10-10s10 4 10 10v6c0 3-3 6-10 6s-10-3-10-6z" fill={ink.skin} />
      <path d="M38 45c-2 12 2 24 12 31 10-7 14-19 12-31-3 3-7 4-12 4s-9-1-12-4z" fill={ink.beard} />
      <path d="M45 56l2 12M55 56l-2 12M44 48c3-2 9-2 12 0" fill="none" strokeWidth="2" />
      <path d="M42 37h5M53 37h5" fill="none" strokeWidth="2.4" />
      {dot(ink, 44.5, 41)}
      {dot(ink, 55.5, 41)}
      <path d="M39 31c-9 0-15-7-15-17 4 5 9 8 15 8zM61 31c9 0 15-7 15-17-4 5-9 8-15 8z" fill={ink.bone} />
      <path d="M38 35c0-10 5-16 12-16s12 6 12 16z" fill={ink.metal} />
      <path d="M37 33h26v4H37z" fill={ink.metal} />
      <path d="M42 21l2-9 3 5 3-10 3 10 3-5 2 9z" fill={ink.crown} />
    </>
  ),
}

const draw = (kind: string, ink: Ink) => (
  <g stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
    {SHAPES[kind](ink)}
  </g>
)

export const vikings: SkinDef = {
  id: 'vikings',
  labelKey: 'skin_vikings',
  only: 'pieces',
  pair: 'fjord',
  light: fjord.light,
  dark: fjord.dark,
  coordLight: fjord.coordLight,
  coordDark: fjord.coordDark,
  frame: fjord.frame,
  pieces: buildPieces('Vikings', WHITE, BLACK, draw),
}
