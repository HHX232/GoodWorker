'use client'

import { useId, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { getSkin, SKINS } from '../skins'
import { useBoardTheme, usePieceSet } from '../skins/useSkinPrefs'
import styles from './SkinPicker.module.scss'

/** Two independent rows: board colours (mini board) and piece set (knight + queen on the chosen board). */
export function SkinPicker({ className }: { className?: string }) {
  const t = useTranslations('chess.core')
  const id = useId()
  const [boardId, setBoard] = useBoardTheme()
  const [piecesId, setPieces] = usePieceSet()
  const board = getSkin(boardId)

  return (
    <div className={`${styles.picker} ${className ?? ''}`}>
      <span className={styles.label} id={`${id}b`}>{t('pick_board')}</span>
      <div className={styles.row} role="group" aria-labelledby={`${id}b`}>
        {SKINS.map((s) => (
          <button key={s.id} type="button" className={styles.option} aria-pressed={boardId === s.id} onClick={() => setBoard(s.id)}>
            <span
              className={styles.tile}
              style={{ '--l': s.light, '--d': s.dark, '--f': s.frame ?? 'rgba(0,0,0,0.12)' } as CSSProperties}
              data-kind="board"
              aria-hidden="true"
            />
            <span className={styles.name}>{t(s.labelKey)}</span>
          </button>
        ))}
      </div>

      <span className={styles.label} id={`${id}p`}>{t('pick_pieces')}</span>
      <div className={styles.row} role="group" aria-labelledby={`${id}p`}>
        {SKINS.map((s) => {
          const N = s.pieces.wN
          const Q = s.pieces.bQ
          return (
            <button key={s.id} type="button" className={styles.option} aria-pressed={piecesId === s.id} onClick={() => setPieces(s.id)}>
              <span
                className={styles.tile}
                style={{ '--l': board.light, '--d': board.dark, '--f': board.frame ?? 'rgba(0,0,0,0.12)' } as CSSProperties}
                data-kind="pieces"
                aria-hidden="true"
              >
                <N className={styles.piece} />
                <Q className={styles.piece} />
              </span>
              <span className={styles.name}>{t(s.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
