'use client'

import Image from 'next/image'

// Local high-quality SVGs in /public/flags/
const LOCAL_FLAGS: Record<string, string> = {
  RU: '/flags/flag-for-flag-russia-svgrepo-com.svg',
  CN: '/flags/flag-cn-svgrepo-com.svg',
  IN: '/flags/flag-for-flag-india-svgrepo-com.svg',
  BY: '/flags/flag-for-flag-belarus-svgrepo-com.svg',
  US: '/flags/flag-um-svgrepo-com.svg',
}

const GLOBE_SRC = '/flags/globe-svgrepo-com.svg'

interface Props {
  code: string
  width?: number
  height?: number
  className?: string
}

export function FlagIcon({ code, width = 20, height, className }: Props) {
  const h = height ?? Math.round(width * 0.75)
  const upper = code.toUpperCase()

  // Globe fallback
  if (upper === 'GLOBE' || !upper) {
    return (
      <Image
        src={GLOBE_SRC}
        alt="globe"
        width={width}
        height={h}
        className={className}
        style={{ display: 'block', flexShrink: 0 }}
      />
    )
  }

  // Local SVG
  const localSrc = LOCAL_FLAGS[upper]
  if (localSrc) {
    return (
      <Image
        src={localSrc}
        alt={upper}
        width={width}
        height={h}
        className={className}
        style={{ display: 'block', flexShrink: 0, borderRadius: 2 }}
      />
    )
  }

  // flag-icons CSS sprite for everything else
  return (
    <span
      className={`fi fi-${upper.toLowerCase()} ${className ?? ''}`}
      style={{
        display: 'inline-block',
        width,
        height: h,
        flexShrink: 0,
        borderRadius: 2,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        verticalAlign: 'middle',
      }}
      aria-label={upper}
    />
  )
}
