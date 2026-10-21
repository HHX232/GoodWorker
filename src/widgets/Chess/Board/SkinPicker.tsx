'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { badgeText } from '@/widgets/Chess/Progress'
import { BOARD_SKINS, getSkin, PIECE_SKINS, skinOpen, type SkinDef } from '../skins'
import { useBoardTheme, useMyBadges, usePieceSet } from '../skins/useSkinPrefs'
import styles from './SkinPicker.module.scss'

/** Two independent rows: board colours (mini board) and piece set (knight + queen on the chosen board).
 *  Reward skins (G24) show a lock and their badge until it is earned; a closed one cannot be picked. */
export function SkinPicker({ className }: { className?: string }) {
  const t = useTranslations('chess.core')
  const tp = useTranslations('chess.progress')
  const id = useId()
  const [boardId, setBoard] = useBoardTheme()
  const [piecesId, setPieces] = usePieceSet()
  const board = getSkin(boardId)
  const mine = useMyBadges()
  const badges = mine === 'loading' ? null : mine

  const option = (s: SkinDef, pressed: boolean, pick: () => void, tile: ReactNode) => {
    const open = skinOpen(s, badges)
    // the condition in plain words («Победи бота 3-го уровня»), not the badge's short name
    const how = s.unlock && !open ? (() => {
      const b = badgeText(s.unlock)
      return tp(b.hintKey, b.values)
    })() : null
    const unlock = how && tp('skin_locked', { badge: how })
    return (
      <button
        key={s.id}
        type="button"
        className={styles.option}
        aria-pressed={pressed}
        aria-disabled={!open || undefined}
        aria-label={unlock ? `${t(s.labelKey)}. ${unlock}` : undefined}
        title={unlock ?? undefined}
        onClick={open ? pick : undefined}
      >
        <span className={styles.tileWrap}>
          {tile}
          {unlock && (
            <span className={styles.lock} aria-hidden="true">
              <Lock size={10} strokeWidth={2.6} />
            </span>
          )}
        </span>
        <span className={styles.name}>{t(s.labelKey)}</span>
        {how && <span className={styles.unlock}>{how}</span>}
      </button>
    )
  }

  return (
    <div className={`${styles.picker} ${className ?? ''}`}>
      <span className={styles.label} id={`${id}b`}>{t('pick_board')}</span>
      <div className={styles.row} role="group" aria-labelledby={`${id}b`}>
        {BOARD_SKINS.map((s) =>
          option(s, boardId === s.id, () => setBoard(s.id), (
            <span
              className={styles.tile}
              style={{ '--l': s.light, '--d': s.dark, '--f': s.frame ?? 'rgba(0,0,0,0.12)' } as CSSProperties}
              data-kind="board"
              aria-hidden="true"
            />
          )),
        )}
      </div>

      <span className={styles.label} id={`${id}p`}>{t('pick_pieces')}</span>
      <div className={styles.row} role="group" aria-labelledby={`${id}p`}>
        {PIECE_SKINS.map((s) => {
          const N = s.pieces.wN
          const Q = s.pieces.bQ
          return option(s, piecesId === s.id, () => setPieces(s.id), (
            <span
              className={styles.tile}
              style={{ '--l': board.light, '--d': board.dark, '--f': board.frame ?? 'rgba(0,0,0,0.12)' } as CSSProperties}
              data-kind="pieces"
              aria-hidden="true"
            >
              <N className={styles.piece} />
              <Q className={styles.piece} />
            </span>
          ))
        })}
      </div>
      {mine === null && <p className={styles.guest}>{tp('skin_locked_guest')}</p>}
    </div>
  )
}
