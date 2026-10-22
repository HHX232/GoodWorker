'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { Pause, Play } from 'lucide-react'
import { getSkin } from '@/widgets/Chess/Board'
import { CoachAvatar } from '@/widgets/Chess/Coach'
import { ClassIcon, CLASS_COLOR } from '@/widgets/Chess/Review'
import { OPERA, STILL_PLY, project, type Frame } from './operaGame'
import s from './ChessLanding.module.scss'

// The hero's stage: a board seen in perspective, drawn as SVG quads from the same projection that places the
// standing pieces — so squares and pieces can never drift apart. Pieces are the marble set, upright, scaled by depth.

const FILES = 'abcdefgh'
const M = 0.05 // frame margin around the squares, in board sides
const EDGE = 0.045 // front face thickness
const TOP = 0.2 // headroom for the back rank's pieces

const near = project(-M, 1 + M)
const far = project(-M, -M)
const minX = near.x
const W = -2 * minX
const minY = far.y - TOP
const maxY = near.y + EDGE * near.k + 0.02
const H = maxY - minY
/** stage aspect (width / height) — CSS sizes the stage by it */
export const STAGE_AR = W / H

const pt = (u: number, v: number) => {
  const p = project(u, v)
  return `${(p.x - minX).toFixed(4)},${(p.y - minY).toFixed(4)}`
}
const quad = (u0: number, v0: number, u1: number, v1: number) => [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)].join(' ')
const sqQuad = (sq: string) => {
  const f = FILES.indexOf(sq[0])
  const r = 8 - Number(sq[1])
  return quad(f / 8, r / 8, (f + 1) / 8, (r + 1) / 8)
}
const SQUARES = Array.from({ length: 64 }, (_, i) => {
  const f = i % 8
  const r = Math.floor(i / 8)
  return { key: i, points: quad(f / 8, r / 8, (f + 1) / 8, (r + 1) / 8), light: (f + r) % 2 === 0 }
})
const FRONT = (() => {
  const a = project(-M, 1 + M)
  const b = project(1 + M, 1 + M)
  const ax = a.x - minX
  const bx = b.x - minX
  const y = a.y - minY
  const d = EDGE * a.k
  return `${ax},${y} ${bx},${y} ${bx},${y + d} ${ax},${y + d}`
})()

// Recommendation arrows lie on the board plane: the arrow is shaped in board units, then every vertex goes
// through the same projection as the squares — so it foreshortens with the board.
const sqUV = (sq: string) => [(FILES.indexOf(sq[0]) + 0.5) / 8, (8 - Number(sq[1]) + 0.5) / 8]
function arrowPoints(from: string, to: string) {
  const [u0, v0] = sqUV(from)
  const [u1, v1] = sqUV(to)
  const len = Math.hypot(u1 - u0, v1 - v0)
  const [du, dv] = [(u1 - u0) / len, (v1 - v0) / len]
  const [nu, nv] = [-dv, du]
  const W2 = 0.016 // half shaft
  const H2 = 0.042 // half head
  const HEAD = 0.06
  const a = 0.022 // start a little off the centre
  const b = len - 0.012 // tip just short of the target centre
  const at = (t: number, w: number) => pt(u0 + du * t + nu * w, v0 + dv * t + nv * w)
  return [at(a, W2), at(b - HEAD, W2), at(b - HEAD, H2), at(b, 0), at(b - HEAD, -H2), at(b - HEAD, -W2), at(a, -W2)].join(' ')
}
const ARROW_KEYS = (() => {
  const seen = new Map<string, { from: string; to: string; kind: string }>()
  for (const f of OPERA.frames) for (const a of f.arrows) seen.set(`${a.from}${a.to}${a.kind}`, a)
  return [...seen.entries()].map(([key, a]) => ({ key, ...a, points: arrowPoints(a.from, a.to) }))
})()

const PIECES = getSkin('marble').pieces
const PIECE = 1.22 // piece box, in squares

/** piece placement in % of the stage width (the stage is an inline-size container: 1cqw = 1%) */
function place(sq: string) {
  const u = (FILES.indexOf(sq[0]) + 0.5) / 8
  const v = (8 - Number(sq[1]) + 0.8) / 8 // the base stands a little in front of the square's centre
  const p = project(u, v)
  const w = (PIECE / 8 / W) * 100
  return { x: ((p.x - minX) / W) * 100 - w / 2, y: ((p.y - minY) / W) * 100 - w, k: p.k, z: Math.round(v * 100) }
}

/** where a captured piece stood when it was taken */
const lastSquare = (id: string, ply: number) => {
  for (let i = ply; i >= 0; i--) {
    const sq = OPERA.frames[i].pieces.find((o) => o.id === id)?.sq
    if (sq) return sq
  }
  return id
}

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

export function HeroScene() {
  const t = useTranslations('chess.landing')
  const ta = useTranslations('chess.analysis')
  const [ply, setPly] = useState(0)
  const [still, setStill] = useState(false) // prefers-reduced-motion: one key frame, no clock
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false) // pieces are client-only: their SVG ids come from useId
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setStill(mq.matches)
      if (mq.matches) setPly(STILL_PLY)
    }
    apply()
    setMounted(true)
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // run only on screen and in a visible tab
  useEffect(() => {
    const el = root.current
    if (!el) return
    let onScreen = true
    const sync = () => setVisible(onScreen && !document.hidden)
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      sync()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const running = visible && !paused && !still
  useEffect(() => {
    if (!running) return
    const f = OPERA.frames[ply]
    const last = ply === OPERA.frames.length - 1
    const ms = ply === 0 ? 2600 : last ? 6500 : f.note ? 4600 : f.arrows.length ? 2600 : 1350
    const id = setTimeout(() => setPly(last ? 0 : ply + 1), ms)
    return () => clearTimeout(id)
  }, [running, ply])

  const frame = OPERA.frames[ply]
  // the coach keeps talking about the last annotated move until the next one
  const said: Frame | null = [...OPERA.frames.slice(0, ply + 1)].reverse().find((f) => f.note) ?? null
  const letters = t('san_letters').split(',')
  const loc = (san: string) => san.replace(/[KQRBN]/g, (c) => letters['KQRBN'.indexOf(c)] ?? c)
  const label = (f: Frame) => `${Math.ceil(f.ply / 2)}${f.ply % 2 ? '.' : '…'} ${loc(f.san ?? '')}`
  const turn = ply % 2 === 0 ? 'w' : 'b'

  // move list: full rows, the tail that fits
  const rows: Array<{ n: number; w?: Frame; b?: Frame }> = []
  for (let i = 1; i <= ply; i++) {
    const n = Math.ceil(i / 2)
    if (i % 2) rows.push({ n, w: OPERA.frames[i] })
    else rows[rows.length - 1].b = OPERA.frames[i]
  }

  const player = (side: 'w' | 'b') => (
    <div className={s.player} data-side={side} data-active={turn === side && ply < OPERA.frames.length - 1 ? '' : undefined}>
      <span className={s.playerDot} aria-hidden="true" />
      <span className={s.playerName}>{side === 'w' ? t('white_name') : t('black_name')}</span>
      <span className={s.clock}>{mmss(frame.clock[side])}</span>
      <span className={s.clockBar} aria-hidden="true">
        <i style={{ transform: `scaleX(${frame.clock[side] / 600})` }} />
      </span>
    </div>
  )

  const moveCell = (f?: Frame) =>
    f ? (
      <span className={s.mv} data-now={f.ply === ply ? '' : undefined} style={f.note ? ({ '--k': CLASS_COLOR[f.note.cls] } as CSSProperties) : undefined}>
        {loc(f.san ?? '')}
        {f.note && <ClassIcon cls={f.note.cls} size={12} />}
      </span>
    ) : (
      <span className={s.mv} />
    )

  return (
    <div ref={root} className={s.scene}>
      <div className={s.stageCell}>
        <div className={s.stage} style={{ '--ar': STAGE_AR } as CSSProperties} role="img" aria-label={t('scene_label')}>
          <svg className={s.boardSvg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <defs>
              <linearGradient id="gwl-front" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2a2d35" />
                <stop offset="1" stopColor="#0d0e12" />
              </linearGradient>
              <radialGradient id="gwl-spot" cx="0.5" cy="0.55" r="0.62">
                <stop offset="0" stopColor="#ffd9b0" stopOpacity="0.2" />
                <stop offset="0.55" stopColor="#ffd9b0" stopOpacity="0.05" />
                <stop offset="1" stopColor="#000" stopOpacity="0.38" />
              </radialGradient>
            </defs>
            <polygon points={quad(-M, -M, 1 + M, 1 + M)} className={s.frameTop} />
            <polygon points={FRONT} fill="url(#gwl-front)" />
            {SQUARES.map((q) => (
              <polygon key={q.key} points={q.points} className={q.light ? s.sqLight : s.sqDark} />
            ))}
            {frame.from && <polygon points={sqQuad(frame.from)} className={s.sqMove} />}
            {frame.to && <polygon points={sqQuad(frame.to)} className={s.sqMove} />}
            {frame.check && <polygon points={sqQuad(frame.check)} className={s.sqCheck} />}
            <polygon points={quad(-M, -M, 1 + M, 1 + M)} fill="url(#gwl-spot)" />
          </svg>
          <div className={s.pieces} aria-hidden="true">
            {mounted && frame.pieces.map((p) => {
              const Piece = PIECES[p.code]
              // a captured piece fades where it stood
              const at = p.sq ?? lastSquare(p.id, ply)
              const g = place(at)
              return (
                <div
                  key={p.id}
                  className={s.piece}
                  data-gone={p.sq ? undefined : ''}
                  data-side={p.code[0]}
                  style={{ transform: `translate(${g.x}cqw, ${g.y}cqw) scale(${g.k})`, zIndex: g.z, width: `${(PIECE / 8 / W) * 100}cqw` }}
                >
                  <span className={s.pieceShadow} />
                  <Piece className={s.pieceSvg} />
                </div>
              )
            })}
          </div>
          {/* arrows float above the standing pieces (as on any board UI), still in the board's perspective */}
          <svg className={s.arrowSvg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              {ARROW_KEYS.map((a) => (
                <polygon
                  key={a.key}
                  points={a.points}
                  className={s.arrow}
                  data-kind={a.kind}
                  data-on={frame.arrows.some((x) => `${x.from}${x.to}${x.kind}` === a.key) ? '' : undefined}
                />
              ))}
          </svg>
        </div>
      </div>

      <div className={s.players}>
        {player('b')}
        <span className={s.vs}>vs</span>
        {player('w')}
        <p className={s.event}>
          {t('event')} · {t('clock_note')}
        </p>
      </div>

      <div className={s.rail}>
        <div className={s.coach} aria-live="polite">
          <CoachAvatar mood={said?.note?.cls === 'blunder' || said?.note?.cls === 'mistake' ? 'concerned' : said ? 'idle' : 'thinking'} size={40} />
          <div className={s.coachBody}>
            <p className={s.coachHead}>
              <span>{t('coach')}</span>
              {said?.note && (
                <span className={s.cls} style={{ '--k': CLASS_COLOR[said.note.cls] } as CSSProperties}>
                  <ClassIcon cls={said.note.cls} size={14} />
                  {ta(`class_${said.note.cls}`)}
                </span>
              )}
              {said && <span className={s.coachMove}>{label(said)}</span>}
            </p>
            <p key={said?.ply ?? 0} className={s.coachText}>
              {said?.note ? t(said.note.key) : t('intro')}
            </p>
          </div>
          <button type="button" className={s.pp} onClick={() => (still ? (setStill(false), setPaused(false)) : setPaused(!paused))} aria-label={running ? t('pause') : t('resume')}>
            {running ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
        <div className={s.moves} aria-label={t('moves_label')}>
          {rows.slice(-6).map((r) => (
            <div key={r.n} className={s.moveRow}>
              <span className={s.mvN}>{r.n}.</span>
              {moveCell(r.w)}
              {moveCell(r.b)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
