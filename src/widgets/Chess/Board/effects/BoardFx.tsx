import type { CSSProperties, FC } from 'react'
import type { PieceCode } from '../../skins'
import type { FxEvent } from './diffEvents'
import styles from './BoardFx.module.scss'

type Props = {
  events: FxEvent[]
  /** changes with every new fen — remounts the effect nodes so their animations replay */
  gen: number
  layer: 'under' | 'over'
  pos: (sq: string) => { col: number; row: number }
  pieces: Record<PieceCode, FC<{ className?: string }>>
}

const at = (p: { col: number; row: number }): CSSProperties => ({ left: `${p.col * 12.5}%`, top: `${p.row * 12.5}%` })

// 10 shards per pop: crosses, rings, triangles; fixed angles + a per-square twist so neighbours differ
const SHAPES = ['cross', 'ring', 'tri'] as const
function shards(seed: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const ang = ((i * 36 + seed * 23) % 360) * (Math.PI / 180)
    const dist = 8 + ((i * 7 + seed) % 5) * 1.8 // cqi; a square is 12.5cqi
    return {
      shape: SHAPES[i % 3],
      tone: i % 3,
      style: {
        '--dx': `${(Math.cos(ang) * dist).toFixed(2)}cqi`,
        '--dy': `${(Math.sin(ang) * dist).toFixed(2)}cqi`,
        '--rot': `${(i % 2 ? 1 : -1) * (90 + i * 25)}deg`,
        animationDelay: `${(i % 4) * 12}ms`,
      } as CSSProperties,
    }
  })
}

function Shard({ shape }: { shape: (typeof SHAPES)[number] }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {shape === 'cross' && <path d="M4 4 16 16M16 4 4 16" />}
      {shape === 'ring' && <circle cx="10" cy="10" r="6" />}
      {shape === 'tri' && <path d="M10 3 17 16H3Z" />}
    </svg>
  )
}

function Burst() {
  return (
    <svg className={styles.burst} viewBox="0 0 40 40" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="20" y1="9" x2="20" y2="3" transform={`rotate(${i * 45} 20 20)`} />
      ))}
    </svg>
  )
}

/** Effect layer over/under the pieces: never takes pointer events, only transform/opacity animate. */
export function BoardFx({ events, gen, layer, pos, pieces }: Props) {
  if (!events.length) return null
  return (
    <div className={styles.fx} aria-hidden="true">
      {events.map((e, i) => {
        const k = `${gen}.${i}`
        if (e.kind === 'capture') {
          const p = pos(e.square)
          const Piece = pieces[e.code]
          const lightSq = (p.col + p.row) % 2 === 0
          if (layer === 'under')
            return (
              <div key={k} className={styles.cell} style={at(p)}>
                <span className={`${styles.hatch} ${lightSq ? styles.onLight : styles.onDark}`} />
                <Piece className={styles.ghost} />
              </div>
            )
          const seed = p.col * 3 + p.row * 5
          return (
            <div key={k} className={`${styles.cell} ${e.code[0] === 'w' ? styles.fromWhite : styles.fromBlack}`} style={at(p)}>
              <Burst />
              {shards(seed).map((s, j) => (
                <span key={j} className={`${styles.shard} ${styles[`tone${s.tone}`]}`} style={s.style}>
                  <Shard shape={s.shape} />
                </span>
              ))}
            </div>
          )
        }
        if (e.kind === 'promotion' && layer === 'over')
          return (
            <div key={k} className={`${styles.cell} ${styles.promo}`} style={at(pos(e.square))}>
              <span className={styles.ring} />
              <Burst />
            </div>
          )
        if (e.kind === 'check' && layer === 'under')
          return (
            <div key={k} className={styles.cell} style={at(pos(e.square))}>
              <span className={styles.pulse} />
            </div>
          )
        if (e.kind === 'mate' && layer === 'under') {
          const king = pos(e.square)
          const wave = []
          for (let row = 0; row < 8; row++)
            for (let col = 0; col < 8; col++) {
              const d = Math.max(Math.abs(col - king.col), Math.abs(row - king.row))
              wave.push(
                <span key={`${row}.${col}`} className={styles.wave} style={{ ...at({ col, row }), animationDelay: `${d * 55}ms` }} />
              )
            }
          return (
            <div key={k}>
              {wave}
              <div className={styles.cell} style={at(king)}>
                <span className={`${styles.pulse} ${styles.pulseMate}`} />
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
