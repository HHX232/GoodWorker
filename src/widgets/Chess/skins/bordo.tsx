import type { ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'

// Bordo: cream / burgundy positive-negative set. Crowns are the motif — the king,
// the queen and the knight wear one. Shared trumpet foot, one outline weight.
type Ink = { fill: string; line: string; cut: string }
const WHITE: Ink = { fill: '#fffbf2', line: '#4a0f14', cut: '#6b1a1a' }
const BLACK: Ink = { fill: '#2a0608', line: '#f3e6cc', cut: '#f3e6cc' }

const foot = (
  <>
    <path d="M34 77c2-3 5-5 8-5h16c3 0 6 2 8 5z" />
    <rect x="25" y="77" width="50" height="6" rx="1.5" />
    <rect x="21" y="83" width="58" height="6" rx="1.5" />
  </>
)

// Open crown: three points, pearl tips. Drawn at origin, placed with a transform.
const crown = (t: string) => (
  <g transform={t}>
    <path d="M-12 0l-4-14 8 6 8-12 8 12 8-6-4 14z" />
    <rect x="-12" y="0" width="24" height="5" rx="1" />
    <circle cx="-16" cy="-15" r="2.6" />
    <circle cx="0" cy="-21" r="2.6" />
    <circle cx="16" cy="-15" r="2.6" />
  </g>
)

const cut = (ink: Ink, d: string) => (
  <path d={d} fill="none" stroke={ink.cut} strokeWidth="2.2" strokeLinecap="round" />
)

const royalBody = (
  <>
    <path d="M38 72c3-8 6-17 6-25h12c0 8 3 17 6 25z" />
    <ellipse cx="50" cy="46" rx="15" ry="4" />
  </>
)

const SHAPES: Record<string, (ink: Ink) => ReactNode> = {
  P: () => (
    <>
      <path d="M42 55c0 7-3 12-6 17h28c-3-5-6-10-6-17z" />
      <ellipse cx="50" cy="54" rx="12" ry="3.5" />
      <circle cx="50" cy="40" r="11.5" />
      {foot}
    </>
  ),
  R: (ink) => (
    <>
      <path d="M35 72l3-29h24l3 29z" />
      <path d="M30 20h9v7h6v-7h10v7h6v-7h9v18l-5 5H35l-5-5z" />
      {foot}
      {cut(ink, 'M39 43h22')}
    </>
  ),
  B: (ink) => (
    <>
      <path d="M43 51c0 8-3 15-6 21h26c-3-6-6-13-6-21z" />
      <ellipse cx="50" cy="49" rx="14" ry="4" />
      <path d="M50 18c11 9 15 19 11 29H39c-4-10 0-20 11-29z" />
      <circle cx="50" cy="13" r="4.5" />
      {foot}
      {cut(ink, 'M56 26l-9 11')}
    </>
  ),
  N: (ink) => (
    <>
      <path d="M36 72c-1-8 2-14 7-19-5 1-10 3-15 1-4-2-5-6-3-10l11-14c3-4 6-8 8-12 9-1 18 5 22 14 4 9 4 22 2 40z" />
      {crown('translate(57 18) rotate(16) scale(0.62)')}
      {foot}
      {cut(ink, 'M47 29c8 4 12 13 12 26')}
      <circle cx="38" cy="33" r="2.3" fill={ink.cut} stroke="none" />
    </>
  ),
  Q: () => (
    <>
      {royalBody}
      <path d="M36 43c-2-5 0-10 4-12h20c4 2 6 7 4 12z" />
      {crown('translate(50 31) scale(1.2)')}
      {foot}
    </>
  ),
  K: () => (
    <>
      {royalBody}
      <path d="M36 43c-2-5 0-10 4-12h20c4 2 6 7 4 12z" />
      <path d="M36 31c0-9 6-15 14-15s14 6 14 15z" />
      <rect x="35" y="29" width="30" height="5" rx="1" />
      <rect x="47" y="3" width="6" height="15" rx="1" />
      <rect x="42" y="7" width="16" height="5.5" rx="1" />
      {foot}
    </>
  ),
}

const draw = (kind: string, ink: Ink, className?: string) => (
  <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <g fill={ink.fill} stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
      {SHAPES[kind](ink)}
    </g>
  </svg>
)

export const bordo: SkinDef = {
  id: 'bordo',
  labelKey: 'skin_bordo',
  light: '#e6d2ac',
  dark: '#7d2421',
  coordLight: '#7d2421',
  coordDark: '#e6d2ac',
  frame: '#4a0f14',
  pieces: buildPieces('Bordo', WHITE, BLACK, draw),
}
