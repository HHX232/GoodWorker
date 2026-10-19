'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Chess, type Square } from 'chess.js'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { getSkin, type PieceCode, type SkinId } from '../skins'
import { useBoardTheme, usePieceSet } from '../skins/useSkinPrefs'
import styles from './ChessBoard.module.scss'

export type BoardMove = { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
/** `opacity` 0..1 (default 0.82): denser = better; fainter arrows are drawn underneath. */
export type BoardArrow = { from: string; to: string; color?: string; opacity?: number }

export type ChessBoardProps = {
  fen: string
  orientation?: 'w' | 'b'
  /**
   * A legal move was made on the board. The board is controlled: it never moves a piece itself,
   * it only shows `fen`. Accept by passing the new `fen`; leave `fen` unchanged and the piece slides back.
   */
  onMove?: (m: BoardMove) => void
  interactive?: boolean
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  highlights?: Record<string, string>
  /** square of the king in check */
  check?: string | null
  /** board colours; default — the visitor's choice (`useBoardTheme`) */
  boardId?: SkinId
  /** piece set; default — the visitor's choice (`usePieceSet`) */
  piecesId?: SkinId
  className?: string
}

const FILES = 'abcdefgh'
const PROMO: Array<'q' | 'r' | 'b' | 'n'> = ['q', 'r', 'b', 'n']

type Placed = { key: string; code: PieceCode; sq: string }

function parsePlacement(fen: string): Array<{ code: PieceCode; sq: string }> {
  const out: Array<{ code: PieceCode; sq: string }> = []
  const rows = (fen.split(' ')[0] ?? '').split('/')
  rows.forEach((row, r) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b'
        out.push({ code: `${color}${ch.toUpperCase()}` as PieceCode, sq: FILES[f] + (8 - r) })
        f++
      }
    }
  })
  return out
}

// fainter arrows first so the densest one ends on top (sort is stable: equal ones keep their order)
const sortArrow = (a: BoardArrow, i: number) => ({ ...a, i, op: a.opacity ?? 0.82 })

const dist = (a: string, b: string) =>
  Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])))

/** Keeps a stable key per physical piece so a move slides instead of re-mounting. */
function assignKeys(prev: Placed[], next: Array<{ code: PieceCode; sq: string }>, gen: number): Placed[] {
  const free = new Set(prev)
  const out: Array<Placed | null> = next.map((p) => {
    const same = prev.find((o) => free.has(o) && o.code === p.code && o.sq === p.sq)
    if (!same) return null
    free.delete(same)
    return same
  })
  return next.map((p, i) => {
    if (out[i]) return out[i] as Placed
    let best: Placed | null = null
    for (const o of free) if (o.code === p.code && (!best || dist(o.sq, p.sq) < dist(best.sq, p.sq))) best = o
    if (best) {
      free.delete(best)
      return { key: best.key, code: p.code, sq: p.sq }
    }
    return { key: `${p.code}${p.sq}.${gen}`, code: p.code, sq: p.sq }
  })
}

export function ChessBoard({
  fen,
  orientation = 'w',
  onMove,
  interactive = true,
  lastMove,
  arrows,
  highlights,
  check,
  boardId,
  piecesId,
  className,
}: ChessBoardProps) {
  const t = useTranslations('chess.core')
  const [storedBoard] = useBoardTheme()
  const [storedPieces] = usePieceSet()
  const board = getSkin(boardId ?? storedBoard)
  const pieces = getSkin(piecesId ?? storedPieces).pieces
  const boardRef = useRef<HTMLDivElement>(null)
  const squareRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const game = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [fen])
  const canMove = interactive && !!onMove && !!game

  // Piece identity across positions (render-time state update, React's "previous props" pattern).
  const [placed, setPlaced] = useState(() => ({ fen, gen: 0, items: assignKeys([], parsePlacement(fen), 0) }))
  if (placed.fen !== fen) {
    const gen = placed.gen + 1
    setPlaced({ fen, gen, items: assignKeys(placed.items, parsePlacement(fen), gen) })
  }
  const pieceAt = useMemo(() => new Map(placed.items.map((p) => [p.sq, p])), [placed.items])

  const [selected, setSelected] = useState<string | null>(null)
  // x/y: pointer in viewport px; rx/ry: piece top-left relative to the board (set in handlers, not render)
  const [drag, setDrag] = useState<{
    from: string
    key: string
    x: number
    y: number
    rx: number
    ry: number
    moved: boolean
    wasSelected: boolean
  } | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const [focusSq, setFocusSq] = useState(orientation === 'w' ? 'e2' : 'e7')
  const keyboardFocus = useRef(false)

  const [selFen, setSelFen] = useState(fen)
  if (selFen !== fen) {
    setSelFen(fen)
    setSelected(null)
    setPromo(null)
  }

  const targets = useMemo(() => {
    if (!canMove || !selected || !game) return new Map<string, { capture: boolean; promotion: boolean }>()
    const m = new Map<string, { capture: boolean; promotion: boolean }>()
    for (const mv of game.moves({ square: selected as Square, verbose: true }))
      m.set(mv.to, { capture: !!mv.captured, promotion: !!mv.promotion })
    return m
  }, [canMove, selected, game])

  const ownPiece = (sq: string) => {
    const p = pieceAt.get(sq)
    return !!p && !!game && p.code[0] === game.turn()
  }

  // display position of a square: col/row 0..7 from the top-left corner as seen
  const pos = (sq: string) => {
    const f = sq.charCodeAt(0) - 97
    const r = Number(sq[1]) - 1
    return orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r }
  }
  const squareAtPos = (col: number, row: number) =>
    orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1)

  const squareAtPoint = (x: number, y: number) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return null
    const col = Math.floor(((x - rect.left) / rect.width) * 8)
    const row = Math.floor(((y - rect.top) / rect.height) * 8)
    if (col < 0 || col > 7 || row < 0 || row > 7) return null
    return squareAtPos(col, row)
  }

  const commit = (m: BoardMove) => {
    onMove?.(m)
    setSelected(null)
    setPromo(null)
  }

  const tryMove = (from: string, to: string) => {
    const legal = game?.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to) ?? []
    if (!legal.length) return setSelected(ownPiece(to) ? to : null)
    if (legal.some((m) => m.promotion)) return setPromo({ from, to })
    commit({ from, to })
  }

  const activate = (sq: string) => {
    if (!canMove || promo) return
    if (selected && targets.has(sq)) return tryMove(selected, sq)
    if (ownPiece(sq)) return setSelected(selected === sq ? null : sq)
    setSelected(null)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canMove || promo || e.button !== 0) return
    const sq = squareAtPoint(e.clientX, e.clientY)
    if (!sq) return
    setFocusSq(sq)
    if (selected && targets.has(sq)) {
      tryMove(selected, sq)
      return
    }
    if (!ownPiece(sq)) {
      setSelected(null)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: sq, key: pieceAt.get(sq)!.key, x: e.clientX, y: e.clientY, rx: 0, ry: 0, moved: false, wasSelected: selected === sq })
    setSelected(sq)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4
    const rect = e.currentTarget.getBoundingClientRect()
    const half = rect.width / 16
    setDrag({ ...drag, x: e.clientX, y: e.clientY, rx: e.clientX - rect.left - half, ry: e.clientY - rect.top - half, moved })
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const to = squareAtPoint(e.clientX, e.clientY)
    setDrag(null)
    if (drag.moved) {
      if (to && to !== drag.from) tryMove(drag.from, to)
    } else if (drag.wasSelected) setSelected(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, sq: string) => {
    const { col, row } = pos(sq)
    const step: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
    if (step[e.key]) {
      e.preventDefault()
      const [dc, dr] = step[e.key]
      const c = Math.min(7, Math.max(0, col + dc))
      const r = Math.min(7, Math.max(0, row + dr))
      keyboardFocus.current = true
      setFocusSq(squareAtPos(c, r))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(sq)
    } else if (e.key === 'Escape') {
      setSelected(null)
    }
  }

  useEffect(() => {
    if (!keyboardFocus.current) return
    keyboardFocus.current = false
    squareRefs.current[focusSq]?.focus()
  }, [focusSq])

  useEffect(() => {
    if (!promo) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setPromo(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [promo])

  const squares = []
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const sq = squareAtPos(col, row)
      const light = (col + row) % 2 === 0
      const p = pieceAt.get(sq)
      const target = targets.get(sq)
      squares.push(
        <button
          key={sq}
          ref={(el) => {
            squareRefs.current[sq] = el
          }}
          type="button"
          className={`${styles.square} ${light ? styles.light : styles.dark}`}
          tabIndex={sq === focusSq ? 0 : -1}
          aria-label={p ? t('square_piece', { square: sq, piece: t(`pc_${p.code}`) }) : t('square_empty', { square: sq })}
          aria-pressed={selected === sq}
          onKeyDown={(e) => onKeyDown(e, sq)}
          onFocus={() => setFocusSq(sq)}
        >
          {(lastMove?.from === sq || lastMove?.to === sq) && <span className={styles.lastMove} />}
          {highlights?.[sq] && <span className={styles.fill} style={{ background: highlights[sq] }} />}
          {selected === sq && <span className={styles.selected} />}
          {check === sq && <span className={styles.check} />}
          {target && <span className={target.capture ? styles.captureHint : styles.moveHint} />}
          {col === 0 && <span className={`${styles.coord} ${styles.rank}`}>{sq[1]}</span>}
          {row === 7 && <span className={`${styles.coord} ${styles.file}`}>{sq[0]}</span>}
        </button>
      )
    }

  const promoColor = promo ? pieceAt.get(promo.from)?.code[0] ?? 'w' : 'w'
  const promoPos = promo ? pos(promo.to) : null

  return (
    <div
      ref={boardRef}
      className={`${styles.board} ${canMove ? styles.interactive : ''} ${className ?? ''}`}
      style={
        {
          '--sq-light': board.light,
          '--sq-dark': board.dark,
          '--coord-light': board.coordLight,
          '--coord-dark': board.coordDark,
          '--frame': board.frame ?? 'transparent',
        } as CSSProperties
      }
      role="group"
      aria-label={t('board_label')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <div className={styles.grid}>{squares}</div>

      <div className={styles.pieces} aria-hidden="true">
        {placed.items.map((p) => {
          const Piece = pieces[p.code]
          const { col, row } = pos(p.sq)
          const dragging = !!drag?.moved && drag.key === p.key
          const style: CSSProperties = dragging
            ? { transform: `translate(${drag.rx}px, ${drag.ry}px)` }
            : { transform: `translate(${col * 100}%, ${row * 100}%)` }
          const cls = [styles.piece, dragging ? styles.dragging : '']
          return (
            <div key={p.key} className={cls.join(' ')} style={style}>
              <Piece className={styles.pieceSvg} />
            </div>
          )
        })}
      </div>

      {!!arrows?.length && (
        <svg className={styles.arrows} viewBox="0 0 800 800" aria-hidden="true">
          {arrows.map(sortArrow).sort((a, b) => a.op - b.op).map((a) => {
            const s = pos(a.from)
            const d = pos(a.to)
            const x1 = s.col * 100 + 50
            const y1 = s.row * 100 + 50
            const x2 = d.col * 100 + 50
            const y2 = d.row * 100 + 50
            const ang = Math.atan2(y2 - y1, x2 - x1)
            const len = Math.hypot(x2 - x1, y2 - y1)
            if (!len) return null
            const head = 34
            const ex = x2 - Math.cos(ang) * (head + 6)
            const ey = y2 - Math.sin(ang) * (head + 6)
            const tip = { x: x2 - Math.cos(ang) * 8, y: y2 - Math.sin(ang) * 8 }
            const wing = (sgn: number) =>
              `${ex + Math.cos(ang + (sgn * Math.PI) / 2) * 22},${ey + Math.sin(ang + (sgn * Math.PI) / 2) * 22}`
            const color = a.color ?? '#2f8f5b'
            return (
              <g key={a.i} style={{ fill: color, stroke: color }} opacity={a.op}>
                <line x1={x1 + Math.cos(ang) * 18} y1={y1 + Math.sin(ang) * 18} x2={ex} y2={ey} strokeWidth={15} strokeLinecap="round" />
                <polygon points={`${tip.x},${tip.y} ${wing(1)} ${wing(-1)}`} stroke="none" />
              </g>
            )
          })}
        </svg>
      )}

      {promo && promoPos && (
        <div className={styles.promoLayer} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={styles.promoBackdrop} aria-label={t('promotion_cancel')} onClick={() => setPromo(null)} />
          <div
            className={styles.promoColumn}
            role="dialog"
            aria-label={t('promotion_title')}
            style={{
              left: `${promoPos.col * 12.5}%`,
              top: promoPos.row < 4 ? `${promoPos.row * 12.5}%` : undefined,
              bottom: promoPos.row >= 4 ? `${(7 - promoPos.row) * 12.5}%` : undefined,
              flexDirection: promoPos.row < 4 ? 'column' : 'column-reverse',
            }}
          >
            {PROMO.map((k, i) => {
              const code = `${promoColor}${k.toUpperCase()}` as PieceCode
              const Piece = pieces[code]
              return (
                <button
                  key={k}
                  type="button"
                  className={styles.promoPiece}
                  aria-label={t(`pc_${code}`)}
                  autoFocus={i === 0}
                  onClick={() => commit({ from: promo.from, to: promo.to, promotion: k })}
                >
                  <Piece className={styles.pieceSvg} />
                </button>
              )
            })}
            <button type="button" className={styles.promoCancel} aria-label={t('promotion_cancel')} onClick={() => setPromo(null)}>
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
