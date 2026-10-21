'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Check, Lock } from 'lucide-react'
import { getSkin, usePieceSet } from '@/widgets/Chess/Board'
import { LEVEL_SIZE, levelPiece, levelTerrain, pathAt, TERRAINS, type Terrain } from './pathModel'
import styles from './Path.module.scss'

// The path is drawn on an isometric chessboard: the ground is a diamond checker (W × H cells) and every step is a
// raised square standing on one of its cells. A step moves half a cell sideways and half a cell up — the next
// diagonal square, so the path alternates light/dark like a bishop walking the board, in runs of four.
const W = 104
const H = 60
const T = 16 // block height
const DX = W / 2
const DY = H / 2
const WORLD_W = 9 * W
const CX = WORLD_W / 2
const PAD_T = 3 * H // even number of half-cells: keeps the steps on the ground's cells
const PAD_B = 3 * H
const HOP_MS = 560

/** −2…2: runs of four steps right, four left */
const lane = (k: number) => {
  const f = k % 8
  return (f <= 4 ? f : 8 - f) - 2
}

type Decor = 'tree' | 'bush' | 'pond' | 'flowers' | 'rock' | 'water' | 'reeds' | 'maple' | 'shroom' | 'pine' | 'snowrock' | 'star' | 'lantern' | 'moon'
const DECOR: Record<Terrain, Decor[]> = {
  meadow: ['tree', 'flowers', 'bush', 'pond', 'tree', 'rock', 'flowers', 'tree', 'bush', 'flowers'],
  shore: ['water', 'rock', 'reeds', 'flowers', 'water', 'reeds', 'rock', 'water', 'bush', 'reeds'],
  autumn: ['maple', 'shroom', 'bush', 'maple', 'rock', 'maple', 'shroom', 'pond', 'maple', 'bush'],
  snow: ['pine', 'snowrock', 'pine', 'pine', 'pond', 'pine', 'snowrock', 'pine', 'pine', 'snowrock'],
  night: ['moon', 'star', 'lantern', 'star', 'rock', 'lantern', 'star', 'lantern', 'star', 'star'],
}

export type PuzzlePathProps = {
  /** steps passed (clean solves) */
  solved: number
  /** start the walk from here on mount (the page knows what the player saw last) */
  from?: number
  /** the current step was clicked / activated */
  onPlay?: () => void
  /** narrow side version: no plaques, smaller */
  compact?: boolean
  className?: string
}

export function PuzzlePath({ solved, from, onPlay, compact, className }: PuzzlePathProps) {
  const t = useTranslations('chess.learn')
  const [pieceSet] = usePieceSet()
  const pieces = getSkin(pieceSet).pieces

  // `shown` walks toward `solved` one step at a time
  const [shown, setShown] = useState(() => Math.min(from ?? solved, solved))
  useEffect(() => {
    if (shown === solved) return
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (shown > solved || still) {
      const id = setTimeout(() => setShown(solved), 0)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setShown((s) => s + 1), shown === Math.min(from ?? solved, solved) ? 380 : HOP_MS)
    return () => clearTimeout(id)
  }, [shown, solved, from])

  const target = Math.max(shown, solved)
  const levels = pathAt(target).current.level + 1 // every reached level + the next one under fog
  const n = levels * LEVEL_SIZE
  const worldH = (n - 1) * DY + PAD_T + PAD_B
  const x = (k: number) => CX + lane(k) * DX
  const y = (k: number) => PAD_T + (n - 1 - k) * DY
  const cur = pathAt(shown).current
  const curLevel = cur.level
  const piece = levelPiece(curLevel)
  const Piece = pieces[`w${piece}`]

  // fit the world to the pane width
  const viewRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(compact ? 0.56 : 1)
  const [viewH, setViewH] = useState(0) // the pane settles after first paint (grid, fonts): re-centre when it does
  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const fit = () => {
      setScale(Math.min(compact ? 0.62 : 1.1, el.clientWidth / (compact ? 560 : 600)))
      setViewH(el.clientHeight)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])

  // keep the traveller in view; offer a way back when the player scrolls away
  const [away, setAway] = useState<0 | 1 | -1>(0)
  const lastShown = useRef(shown) // smooth only for a hop; resizes and the first paint jump
  const focusY = () => (y(shown) - T) * scale
  const toCurrent = (smooth: boolean) => {
    const el = viewRef.current
    if (!el) return
    el.scrollTo({ top: focusY() - el.clientHeight * 0.58, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    toCurrent(lastShown.current !== shown)
    lastShown.current = shown
    // re-centre on every hop / resize; toCurrent reads the latest layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, scale, n, viewH])
  const onScroll = () => {
    const el = viewRef.current
    if (!el) return
    const d = focusY() - (el.scrollTop + el.clientHeight * 0.58)
    setAway(Math.abs(d) < el.clientHeight * 0.55 ? 0 : d > 0 ? 1 : -1)
  }

  const regions = Array.from({ length: levels }, (_, L) => {
    const top = L === levels - 1 ? 0 : y(L * LEVEL_SIZE + LEVEL_SIZE - 0.5)
    const bottom = L === 0 ? worldH : y(L * LEVEL_SIZE - 0.5)
    return { L, top, bottom, terrain: levelTerrain(L + 1) }
  })

  return (
    <div className={`${styles.path} ${compact ? styles.compact : ''} ${className ?? ''}`} data-terrain={levelTerrain(curLevel)}>
      <div ref={viewRef} className={styles.view} onScroll={onScroll}>
        <div className={styles.sizer} style={{ height: worldH * scale }}>
          <div className={styles.world} style={{ width: WORLD_W, height: worldH, transform: `translateX(-50%) scale(${scale})` }}>
            <Ground regions={regions} worldH={worldH} y={y} />

            {!compact &&
              regions.map(({ L, bottom, terrain }) => {
                const k = L * LEVEL_SIZE + 2
                const side = lane(k) >= 0 ? -1 : 1
                return (
                  <div key={`p${L}`} className={styles.plaque} data-terrain={terrain} style={{ left: CX + side * 4.6 * DX, top: Math.min(bottom, worldH) - 2.6 * H }}>
                    <span className={styles.plaqueNum}>{L + 1}</span>
                    <span className={styles.plaqueText}>
                      <strong>{t('path_level', { n: L + 1 })}</strong>
                      <span>{t(`path_terrain_${terrain}`)}</span>
                    </span>
                  </div>
                )
              })}

            {/* the next figure waits on a plinth at each level's summit */}
            {regions.map(({ L }) => {
              const k = L * LEVEL_SIZE + LEVEL_SIZE - 1
              const Next = pieces[`w${levelPiece(L + 2)}`]
              const side = lane(k) >= 0 ? 1 : -1
              return (
                <div key={`m${L}`} className={styles.monument} data-reached={L + 1 < curLevel || undefined} style={{ left: x(k) + side * 3.6 * DX, top: y(k) - H * 1.1 }} aria-hidden="true">
                  <Next className={styles.monumentPiece} />
                  <span className={styles.plinth} />
                </div>
              )
            })}

            <ol className={styles.steps} aria-label={t('path_aria', { n: cur.step })}>
              {Array.from({ length: n }, (_, k) => {
                const state = k < shown ? 'done' : k === shown ? 'current' : 'next'
                const lvl = Math.floor(k / LEVEL_SIZE) + 1
                const fog = lvl > curLevel
                const label = k + 1
                const style = { left: x(k) - W / 2, top: y(k) - H / 2 - T, zIndex: n - k + 10 } as CSSProperties
                return (
                  <li
                    key={k}
                    className={styles.step}
                    style={style}
                    data-state={state}
                    data-sq={Math.abs(lane(k)) % 2 === 0 ? 'l' : 'd'}
                    data-terrain={levelTerrain(lvl)}
                    data-fog={fog || undefined}
                    data-fresh={state === 'done' && k === shown - 1 && shown !== from ? '' : undefined}
                    data-summit={(k + 1) % LEVEL_SIZE === 0 || undefined}
                  >
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={state !== 'current' || !onPlay}
                      onClick={onPlay}
                      tabIndex={state === 'current' && onPlay ? 0 : -1}
                      aria-label={t(state === 'done' ? 'path_step_done' : state === 'current' ? 'path_step_current' : 'path_step_next', { n: label })}
                      aria-current={state === 'current' ? 'step' : undefined}
                    >
                      <svg viewBox={`0 0 ${W} ${H + T}`} className={styles.block} aria-hidden="true">
                        <polygon className={styles.faceL} points={`0,${H / 2} ${W / 2},${H} ${W / 2},${H + T} 0,${H / 2 + T}`} />
                        <polygon className={styles.faceR} points={`${W / 2},${H} ${W},${H / 2} ${W},${H / 2 + T} ${W / 2},${H + T}`} />
                        <polygon className={styles.faceTop} points={`${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`} />
                        <polygon className={styles.faceInset} points={`${W / 2},9 ${W - 16},${H / 2} ${W / 2},${H - 9} 16,${H / 2}`} />
                      </svg>
                      <span className={styles.stepNum}>{state === 'done' ? <Check size={22} strokeWidth={3.2} /> : label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>

            {regions
              .filter(({ L }) => L + 1 > curLevel)
              .map(({ L, top, bottom }) => (
                <div key={`f${L}`} className={styles.fog} style={{ top, height: bottom - top + H }}>
                  <span className={styles.fogLock}>
                    <Lock size={18} strokeWidth={2.2} aria-hidden="true" />
                    {t('path_locked', { n: L })}
                  </span>
                </div>
              ))}

            <div className={styles.token} style={{ left: x(shown), top: y(shown) - T, zIndex: n + 20 }} aria-hidden="true">
              <span key={shown} className={styles.hop}>
                <span key={piece} className={styles.tokenPiece}>
                  <Piece />
                </span>
              </span>
              <span className={styles.tokenShadow} />
            </div>
          </div>
        </div>
      </div>
      {away !== 0 && (
        <button type="button" className={styles.back} onClick={() => toCurrent(true)} aria-label={t('path_to_current')}>
          {away > 0 ? <ArrowDown size={20} aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}

type Region = { L: number; top: number; bottom: number; terrain: Terrain }

function Ground({ regions, worldH, y }: { regions: Region[]; worldH: number; y: (k: number) => number }) {
  // each region's lower edge is a soft hedge line drawn over the region below it
  const wave = (yy: number) => {
    let d = `L${WORLD_W},${yy}`
    for (let i = WORLD_W; i > 0; i -= 52) d += ` Q${i - 26},${yy + (i % 104 ? 14 : -10)} ${i - 52},${yy}`
    return d
  }
  return (
    <svg className={styles.ground} width={WORLD_W} height={worldH} viewBox={`0 0 ${WORLD_W} ${worldH}`} aria-hidden="true">
      <defs>
        {TERRAINS.map((tr) => (
          <pattern key={tr} id={`gw-path-${tr}`} width={W} height={H} patternUnits="userSpaceOnUse">
            <rect width={W} height={H} className={styles.cellB} data-terrain={tr} />
            <polygon points={`${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`} className={styles.cellA} data-terrain={tr} />
          </pattern>
        ))}
      </defs>
      {regions.map(({ L, top, bottom, terrain }) => (
        <path
          key={L}
          d={`M0,${top} L${WORLD_W},${top} ${L === 0 ? `L${WORLD_W},${bottom} L0,${bottom}` : wave(bottom)} Z`}
          fill={`url(#gw-path-${terrain})`}
          className={styles.region}
          data-terrain={terrain}
        />
      ))}
      {regions.map(({ L, terrain }) =>
        DECOR[terrain].map((kind, i) => {
          const k = L * LEVEL_SIZE + 4 + Math.round(i * 1.6) // clear of the level plaque at the start
          const side = lane(k) >= 0 ? -1 : 1
          const dx = (i % 2 ? 3.3 : 4.9) * DX + ((i * 37) % 3) * 10
          return <DecorItem key={`${L}-${i}`} terrain={terrain} kind={kind} cx={CX + side * dx} cy={y(k)} />
        })
      )}
    </svg>
  )
}

function DecorItem({ kind, cx, cy, terrain }: { kind: Decor; cx: number; cy: number; terrain: Terrain }) {
  const s = styles
  const shadow = <ellipse cx={0} cy={0} rx={26} ry={9} className={s.dShadow} />
  let body
  switch (kind) {
    case 'tree':
    case 'maple':
      body = (
        <>
          {shadow}
          <rect x={-4} y={-30} width={8} height={30} rx={2} className={s.dTrunk} />
          <circle cx={-12} cy={-44} r={20} className={s.dLeafB} />
          <circle cx={10} cy={-50} r={22} className={s.dLeafA} />
          <circle cx={-2} cy={-66} r={18} className={s.dLeafA} />
          <circle cx={4} cy={-60} r={7} className={s.dLeafHi} />
        </>
      )
      break
    case 'bush':
      body = (
        <>
          <ellipse cx={0} cy={0} rx={30} ry={8} className={s.dShadow} />
          <circle cx={-14} cy={-10} r={13} className={s.dLeafB} />
          <circle cx={12} cy={-10} r={14} className={s.dLeafB} />
          <circle cx={0} cy={-18} r={15} className={s.dLeafA} />
        </>
      )
      break
    case 'pine':
      body = (
        <>
          {shadow}
          <rect x={-4} y={-16} width={8} height={16} className={s.dTrunk} />
          <polygon points="0,-92 24,-46 -24,-46" className={s.dLeafA} />
          <polygon points="0,-70 30,-14 -30,-14" className={s.dLeafB} />
          <polygon points="0,-92 10,-73 0,-68 -10,-73" className={s.dSnow} />
          <polygon points="0,-70 12,-48 0,-44 -12,-48" className={s.dSnow} />
        </>
      )
      break
    case 'pond':
    case 'water':
      body = (
        <>
          <ellipse cx={0} cy={-6} rx={kind === 'pond' ? 58 : 76} ry={kind === 'pond' ? 26 : 30} className={s.dWaterEdge} />
          <ellipse cx={0} cy={-8} rx={kind === 'pond' ? 52 : 70} ry={kind === 'pond' ? 22 : 26} className={s.dWater} />
          <path d="M-30,-12 q8,-4 16,0 M4,-2 q8,-4 16,0 M-6,-20 q6,-3 12,0" className={s.dRipple} />
          {kind === 'pond' && <circle cx={22} cy={-14} r={7} className={s.dLeafA} />}
        </>
      )
      break
    case 'rock':
    case 'snowrock':
      body = (
        <>
          <ellipse cx={0} cy={0} rx={28} ry={8} className={s.dShadow} />
          <polygon points="-24,0 -18,-22 2,-32 22,-20 26,0" className={s.dRockB} />
          <polygon points="-18,-22 2,-32 22,-20 2,-12" className={kind === 'snowrock' ? s.dSnow : s.dRockA} />
        </>
      )
      break
    case 'reeds':
      body = (
        <>
          <ellipse cx={0} cy={0} rx={20} ry={6} className={s.dShadow} />
          <path d="M-8,0 q-4,-24 -10,-40 M0,0 q0,-30 2,-48 M8,0 q6,-22 12,-36" className={s.dStem} />
          <rect x={-1} y={-52} width={6} height={14} rx={3} className={s.dTrunk} />
        </>
      )
      break
    case 'flowers':
    case 'shroom':
      body =
        kind === 'flowers' ? (
          <>
            {[[-14, -2], [0, -8], [12, 0], [-4, 6], [20, -10]].map(([a, b], i) => (
              <circle key={i} cx={a} cy={b} r={3.4} className={i % 2 ? s.dPetalA : s.dPetalB} />
            ))}
          </>
        ) : (
          <>
            <ellipse cx={0} cy={0} rx={16} ry={5} className={s.dShadow} />
            <rect x={-3} y={-14} width={6} height={14} rx={2} className={s.dSnow} />
            <path d="M-14,-12 q14,-18 28,0 z" className={s.dCap} />
          </>
        )
      break
    case 'star':
      body = (
        <>
          <path d="M0,-40 L4,-30 L14,-26 L4,-22 L0,-12 L-4,-22 L-14,-26 L-4,-30 Z" className={s.dStar} />
          <circle cx={30} cy={-8} r={2.4} className={s.dStar} />
          <circle cx={-26} cy={4} r={1.8} className={s.dStar} />
        </>
      )
      break
    case 'lantern':
      body = (
        <>
          <ellipse cx={0} cy={0} rx={14} ry={5} className={s.dShadow} />
          <circle cx={0} cy={-46} r={20} className={s.dGlow} />
          <rect x={-2} y={-40} width={4} height={40} className={s.dTrunk} />
          <rect x={-7} y={-54} width={14} height={14} rx={3} className={s.dLamp} />
        </>
      )
      break
    case 'moon':
      body = (
        <>
          <circle cx={0} cy={-60} r={24} className={s.dMoon} />
          <circle cx={10} cy={-66} r={20} className={s.dMoonCut} />
        </>
      )
      break
  }
  return (
    <g transform={`translate(${cx} ${cy})`} data-terrain={terrain}>
      {body}
    </g>
  )
}
