import { useId, type ReactNode } from 'react'
import { buildPieces, type SkinDef } from './types'

// Vintage: chess characters. Every piece is a figure with a sleeping profile, rust hair
// and its rank worn as headgear; cream cap and toothed plinth, ochre body, print grain.
type Ink = { cap: string; body: string; hair: string; line: string }
const WHITE: Ink = { cap: '#e8dcc4', body: '#b89a6a', hair: '#c8643c', line: '#2a2826' }
const BLACK: Ink = { cap: '#141210', body: '#2e1a12', hair: '#7e3820', line: '#b89a6a' }

type Draw = (ink: Ink, grain: string) => ReactNode

const plinth = (ink: Ink) => (
  <>
    <rect x="29" y="78" width="42" height="5" rx="1" fill={ink.cap} />
    <rect x="23" y="83" width="54" height="8" rx="1.5" fill={ink.cap} />
    <path d="M30 91v-3M37 91v-3M44 91v-3M51 91v-3M58 91v-3M65 91v-3M72 91v-3" fill="none" />
  </>
)

// Body from y=t down to the plinth; the face sits on its left, hair falls on its right.
const figure = (ink: Ink, grain: string, t: number) => {
  const body = `M31 78C32 ${t + 14} 33 ${t + 5} 35 ${t}H65C67 ${t + 5} 68 ${t + 14} 69 78Z`
  return (
    <>
      <path d={body} fill={ink.body} />
      <path d={body} fill={grain} stroke="none" />
      <path
        d={`M56 ${t}C66 ${t + 3} 68 ${t + 12} 66 ${t + 22}C65 ${t + 28} 67 ${t + 32} 68 ${t + 36}C61 ${t + 34} 56 ${t + 28} 55 ${t + 20}C54 ${t + 12} 55 ${t + 6} 56 ${t}Z`}
        fill={ink.hair}
      />
      <path
        d={`M40 ${t + 2}C39 ${t + 6} 38 ${t + 9} 35.5 ${t + 13}L39 ${t + 15}L37.5 ${t + 18}L39.5 ${t + 20}C39 ${t + 24} 41 ${t + 26} 45 ${t + 27}`}
        fill="none"
      />
      <path d={`M43 ${t + 9}c1.5 1.5 3.5 1.5 5 0`} fill="none" />
    </>
  )
}

const SHAPES: Record<string, Draw> = {
  P: (ink, g) => (
    <>
      {figure(ink, g, 50)}
      <path d="M35 51c0-12 6-19 15-19s15 7 15 19z" fill={ink.cap} />
      <path d="M44 34v16M50 32v18M56 34v16" fill="none" />
      {plinth(ink)}
    </>
  ),
  R: (ink, g) => (
    <>
      {figure(ink, g, 44)}
      <path d="M33 45V22h7v6h6v-6h8v6h6v-6h7v23z" fill={ink.cap} />
      <path d="M33 38h34" fill="none" />
      {plinth(ink)}
    </>
  ),
  B: (ink, g) => (
    <>
      {figure(ink, g, 42)}
      <circle cx="50" cy="10" r="4" fill={ink.cap} />
      <path d="M50 14c11 7 16 17 15 29H35c-1-12 4-22 15-29z" fill={ink.cap} />
      <path d="M54 22l-8 10M35 37h30" fill="none" />
      {plinth(ink)}
    </>
  ),
  N: (ink, g) => {
    const head =
      'M34 78c0-9 3-15 8-21-6 2-12 3-17 1-4-2-5-6-3-9l12-14c3-4 6-9 8-14l5 6c12 0 22 10 24 24 2 10 1 18-1 27z'
    return (
      <>
        <path d={head} fill={ink.body} />
        <path d={head} fill={g} stroke="none" />
        <path d="M45 22c10-3 22 4 26 16 3 9 2 20 0 30-4-6-7-12-8-20-1-9-6-17-18-26z" fill={ink.hair} />
        <path d="M36 32c1.5 1.5 3.5 1.5 5 0M23 49h4" fill="none" />
        {plinth(ink)}
      </>
    )
  },
  Q: (ink, g) => (
    <>
      {figure(ink, g, 40)}
      <path d="M34 41l-2-18 9 8 4-15 5 12 5-12 4 15 9-8-2 18z" fill={ink.cap} />
      <path d="M34 34h32" fill="none" />
      <path d="M40 72h20" fill="none" strokeDasharray="0.1 5" strokeWidth="3.6" />
      {plinth(ink)}
    </>
  ),
  K: (ink, g) => (
    <>
      {figure(ink, g, 38)}
      <path d="M41 70c2-7 6-12 10-14 4 2 7 6 8 14z" fill={ink.hair} />
      <path d="M34 39V22l6 5 5-8 5 6 5-6 5 8 6-5v17z" fill={ink.cap} />
      <path d="M47 21V12h-5V7h5V3h6v4h5v5h-5v9z" fill={ink.cap} />
      <path d="M34 31h32" fill="none" />
      {plinth(ink)}
    </>
  ),
}

function VintageSvg({ kind, ink, className }: { kind: string; ink: Ink; className?: string }) {
  const id = `vg${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2" r="0.7" fill={ink.line} opacity="0.35" />
          <circle cx="5" cy="5.5" r="0.5" fill={ink.cap} opacity="0.4" />
        </pattern>
      </defs>
      <g stroke={ink.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        {SHAPES[kind](ink, `url(#${id})`)}
      </g>
    </svg>
  )
}

const draw = (kind: string, ink: Ink, className?: string) => <VintageSvg kind={kind} ink={ink} className={className} />

export const vintage: SkinDef = {
  id: 'vintage',
  labelKey: 'skin_vintage',
  light: '#3a3632',
  dark: '#2a2826',
  coordLight: '#8a7f70',
  coordDark: '#8a7f70',
  frame: '#1f1d1b',
  pieces: buildPieces('Vintage', WHITE, BLACK, draw),
}
