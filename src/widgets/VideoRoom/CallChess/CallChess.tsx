'use client'

import { ChessBoard, type BoardMove } from '@/widgets/Chess/Board'
import { playMoveSound } from '@/shared/lib/chess/sound'
import { Chess } from 'chess.js'
import { ArrowUpDown, Lock, RotateCcw, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChessCallState } from './chessSync'
import styles from './CallChess.module.scss'

type Props = {
  state: ChessCallState | null
  isOwner: boolean
  /** A legal move made on this screen. The owner applies it; a participant sends it to the owner. */
  onMove: (m: BoardMove) => void
  /** Owner only. Returns false when the FEN is invalid. */
  onSetPosition: (fen: string) => boolean
  onSetMoveAllowed: (v: ChessCallState['moveAllowed']) => void
}

const pieces = (fen: string) => (fen.split(' ')[0] ?? '').replace(/[^a-z]/gi, '').length

function kingInCheck(chess: Chess): string | null {
  if (!chess.inCheck()) return null
  for (const row of chess.board()) for (const p of row) if (p?.type === 'k' && p.color === chess.turn()) return p.square
  return null
}

export function CallChess({ state, isOwner, onMove, onSetPosition, onSetMoveAllowed }: Props) {
  const t = useTranslations('chess.call')
  const fenId = useId()
  const [orientation, setOrientation] = useState<'w' | 'b'>('w')
  const [fenInput, setFenInput] = useState('')
  const [fenError, setFenError] = useState(false)
  // Participant's own move, shown until the owner's next state arrives (or is refused: dropped after 2 s).
  const [pending, setPending] = useState<{ fen: string; seq: number; lastMove: { from: string; to: string } } | null>(null)
  const shown = pending && state && pending.seq === state.seq ? pending : null
  const fen = shown?.fen ?? state?.fen ?? ''

  useEffect(() => {
    if (!pending) return
    const id = setTimeout(() => setPending(null), 2000)
    return () => clearTimeout(id)
  }, [pending])

  const chess = useMemo(() => (fen ? new Chess(fen) : null), [fen])

  // Sound for every new position that came with a move (own, remote, or after the owner confirmed).
  // A rolled-back preview (owner refused the move) changes the fen with the same seq and no preview: silent.
  const lastFen = useRef<string | null>(null)
  const lastSeq = useRef<number | undefined>(undefined)
  useEffect(() => {
    const prev = lastFen.current
    const seqChanged = lastSeq.current !== state?.seq
    lastFen.current = fen
    lastSeq.current = state?.seq
    if (!prev || !chess || prev === fen || !(shown?.lastMove ?? state?.lastMove)) return
    if (!shown && !seqChanged) return
    if (chess.isGameOver()) playMoveSound('end')
    else if (chess.inCheck()) playMoveSound('check')
    else playMoveSound(pieces(fen) < pieces(prev) ? 'capture' : 'move')
  }, [fen, chess, shown, state?.lastMove, state?.seq])

  if (!state || !chess) {
    return <div className={styles.connecting}>{t('connecting')}</div>
  }

  const canMove = isOwner || state.moveAllowed === 'all'
  const status = chess.isCheckmate()
    ? t(chess.turn() === 'w' ? 'mate_b' : 'mate_w')
    : chess.isGameOver()
      ? t('draw')
      : chess.inCheck()
        ? `${t('check')} · ${t(chess.turn() === 'w' ? 'turn_w' : 'turn_b')}`
        : t(chess.turn() === 'w' ? 'turn_w' : 'turn_b')

  const handleMove = (m: BoardMove) => {
    if (!isOwner) {
      const local = new Chess(state.fen)
      try {
        local.move(m)
        setPending({ fen: local.fen(), seq: state.seq, lastMove: { from: m.from, to: m.to } })
      } catch {
        return // the board only reports legal moves; nothing to show if chess.js disagrees
      }
    }
    onMove(m)
  }

  const applyFen = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = onSetPosition(fenInput)
    setFenError(!ok)
    if (ok) setFenInput('')
  }

  return (
    <div className={styles.root}>
      <div className={styles.boardSlot}>
        <div className={styles.boardFit}>
          <ChessBoard
            fen={fen}
            orientation={orientation}
            interactive={canMove}
            onMove={canMove ? handleMove : undefined}
            lastMove={shown?.lastMove ?? state.lastMove}
            check={kingInCheck(chess)}
          />
        </div>
      </div>

      <aside className={styles.rail}>
        <p className={styles.status} aria-live="polite">
          <span className={`${styles.turnDot} ${chess.turn() === 'b' ? styles.turnDotBlack : ''}`} aria-hidden />
          {status}
        </p>

        {!isOwner && (
          <p className={`${styles.access} ${canMove ? '' : styles.accessLocked}`}>
            {canMove ? <Users size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
            {canMove ? t('open_all') : t('locked')}
          </p>
        )}

        {isOwner && (
          <>
            <div className={styles.group}>
              <span className={styles.groupLabel} id={`${fenId}-who`}>{t('who_moves')}</span>
              <div className={styles.segment} role="radiogroup" aria-labelledby={`${fenId}-who`}>
                {(['all', 'owner'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={state.moveAllowed === v}
                    className={`${styles.segmentBtn} ${state.moveAllowed === v ? styles.segmentOn : ''}`}
                    onClick={() => state.moveAllowed !== v && onSetMoveAllowed(v)}
                  >
                    {v === 'all' ? <Users size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
                    {t(v === 'all' ? 'allow_all' : 'allow_owner')}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.action} onClick={() => setOrientation(o => (o === 'w' ? 'b' : 'w'))} title={t('flip_hint')}>
                <ArrowUpDown size={15} aria-hidden /> {t('flip')}
              </button>
              <button type="button" className={styles.action} onClick={() => { onSetPosition(new Chess().fen()); setFenError(false) }}>
                <RotateCcw size={15} aria-hidden /> {t('reset')}
              </button>
            </div>

            <form className={styles.group} onSubmit={applyFen}>
              <label className={styles.groupLabel} htmlFor={fenId}>{t('fen_label')}</label>
              <div className={styles.fenRow}>
                <input
                  id={fenId}
                  className={`${styles.fenInput} ${fenError ? styles.fenInputBad : ''}`}
                  value={fenInput}
                  onChange={e => { setFenInput(e.target.value); setFenError(false) }}
                  placeholder={t('fen_placeholder')}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={fenError}
                  aria-describedby={fenError ? `${fenId}-err` : undefined}
                />
                <button type="submit" className={styles.fenApply} disabled={!fenInput.trim()}>{t('fen_apply')}</button>
              </div>
              {fenError && <p className={styles.fenError} id={`${fenId}-err`} role="alert">{t('fen_invalid')}</p>}
            </form>
          </>
        )}
      </aside>
    </div>
  )
}
