import type { ReviewClass } from '@/shared/lib/chess/reviewModel'

// Move-class marks: every class has its own silhouette (gem, star, book, hexagon, triangle…) and glyph,
// so they read apart without colour too.
export const CLASS_COLOR: Record<ReviewClass, string> = {
  brilliant: '#17a99b',
  great: '#4a7fc1',
  best: '#5d9e3f',
  excellent: '#78a83a',
  good: '#7f9a78',
  book: '#9c7a55',
  inaccuracy: '#e3b23c',
  mistake: '#e07b2c',
  miss: '#d9584a',
  blunder: '#c22d2a',
}

const W = '#fff'
const bang = (x: number, top = 6.5) => (
  <>
    <path d={`M${x} ${top}v6.4`} stroke={W} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx={x} cy="17.2" r="1.45" fill={W} />
  </>
)
const ask = (x: number, ink = W) => (
  <>
    <path d={`M${x - 2.6} 9.2a2.7 2.7 0 1 1 3.9 2.4c-.85.45-1.3 1.05-1.3 1.95v.5`} stroke={ink} strokeWidth="2.3" strokeLinecap="round" fill="none" />
    <circle cx={x} cy="17.2" r="1.4" fill={ink} />
  </>
)

const SHAPES: Record<ReviewClass, (c: string) => React.ReactNode> = {
  // cut gem with a double "!"
  brilliant: (c) => (
    <>
      <path d="M12 1.2 22.8 12 12 22.8 1.2 12Z" fill={c} />
      {bang(9.9, 7.2)}
      {bang(14.1, 7.2)}
    </>
  ),
  great: (c) => (
    <>
      <circle cx="12" cy="12" r="11" fill={c} />
      {bang(12)}
    </>
  ),
  best: (c) => (
    <path
      d="M12 1.4l3.05 6.6 7.2.85-5.33 4.9 1.43 7.12L12 17.3l-6.35 3.57 1.43-7.12-5.33-4.9 7.2-.85Z"
      fill={c}
      stroke={c}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ),
  // rounded square, upward chevron
  excellent: (c) => (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill={c} />
      <path d="M7 14.2l5-5 5 5" stroke={W} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  good: (c) => (
    <>
      <circle cx="12" cy="12" r="11" fill={c} />
      <path d="M7.1 12.4l3.2 3.2 6.6-6.8" stroke={W} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  // open book
  book: (c) => (
    <>
      <path d="M1.5 5.2Q6.6 3.2 12 5.6 17.4 3.2 22.5 5.2V20q-5.1-1.9-10.5.4Q6.6 18.1 1.5 20Z" fill={c} />
      <path d="M12 6.4v13.2M5 8.4q2.6-.5 4.6.4M5 11.6q2.6-.5 4.6.4M14.4 8.8q2-.9 4.6-.4M14.4 12q2-.9 4.6-.4" stroke={W} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  // hexagon "?!"
  inaccuracy: (c) => (
    <>
      <path d="M12 1 21.6 6.5v11L12 23 2.4 17.5v-11Z" fill={c} />
      {ask(9.7, '#3d2c00')}
      <path d="M16 7v6.2" stroke="#3d2c00" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="16" cy="17.2" r="1.35" fill="#3d2c00" />
    </>
  ),
  // octagon "?"
  mistake: (c) => (
    <>
      <path d="M7.4 1h9.2L23 7.4v9.2L16.6 23H7.4L1 16.6V7.4Z" fill={c} />
      {ask(12)}
    </>
  ),
  // circle with a cross: the chance was let go
  miss: (c) => (
    <>
      <circle cx="12" cy="12" r="11" fill={c} />
      <path d="M8 8l8 8M16 8l-8 8" stroke={W} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // warning triangle "??"
  blunder: (c) => (
    <>
      <path d="M12 1.2 23.2 21.6H.8Z" fill={c} strokeLinejoin="round" stroke={c} strokeWidth="1.4" />
      <path d="M7.6 11.6a2.1 2.1 0 1 1 3 1.9c-.6.35-1 .8-1 1.5v.3M14.1 11.6a2.1 2.1 0 1 1 3 1.9c-.6.35-1 .8-1 1.5v.3" stroke={W} strokeWidth="1.9" strokeLinecap="round" fill="none" />
      <circle cx="9.6" cy="18.4" r="1.15" fill={W} />
      <circle cx="16.1" cy="18.4" r="1.15" fill={W} />
    </>
  ),
}

/** Decorative by default; pass `label` to make it an image with a name. */
export function ClassIcon({ cls, size = 20, label, className }: { cls: ReviewClass; size?: number; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))' }}
    >
      {SHAPES[cls](CLASS_COLOR[cls])}
    </svg>
  )
}
