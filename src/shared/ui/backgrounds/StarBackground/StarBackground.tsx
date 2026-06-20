'use client'

import { useMemo } from 'react'
import styles from './StarBackground.module.scss'

const COUNT = 80

function s(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function rng(i: number, salt: number, min: number, max: number) {
  return min + s(i * 31 + salt * 7) * (max - min)
}

export default function StarBackground() {
  const stars = useMemo(() =>
    Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      // random scatter across full screen
      x:    rng(i, 1, 0, 100),
      y:    rng(i, 2, 0, 100),
      size: rng(i, 3, 1.5, 5),
      // 3 random waypoints for chaotic wandering (in px, positive and negative)
      x1: rng(i, 10, -30, 30),  y1: rng(i, 11, -25, 25),
      x2: rng(i, 12, -25, 25),  y2: rng(i, 13, -30, 30),
      x3: rng(i, 14, -20, 20),  y3: rng(i, 15, -20, 20),
      // independent x and y durations → lissajous-like chaotic path
      durX:  rng(i, 20, 12, 28),
      durY:  rng(i, 21, 10, 24),
      delay: rng(i, 22, -15, 0),
    }))
  , [])

  return (
    <div className={styles.bg} aria-hidden>
      {stars.map(s => (
        <span
          key={s.id}
          className={styles.starOuter}
          style={{
            left:  `${s.x}%`,
            top:   `${s.y}%`,
            animationDuration:  `${s.durX}s, ${s.durY}s`,
            animationDelay:     `${s.delay}s, ${s.delay * 0.8}s`,
            '--x1': `${s.x1}px`, '--x2': `${s.x2}px`, '--x3': `${s.x3}px`,
            '--y1': `${s.y1}px`, '--y2': `${s.y2}px`, '--y3': `${s.y3}px`,
          } as React.CSSProperties}
        >
          <span
            className={styles.star}
            style={{ width: `${s.size}px`, height: `${s.size}px` }}
          />
        </span>
      ))}
    </div>
  )
}
