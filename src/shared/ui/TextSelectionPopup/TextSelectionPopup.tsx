'use client'

import { useTextSelection } from '../Providers/TextSelectionProvider/TextSelectionProvider'
import styles from './TextSelectionPopup.module.scss'

const POPUP_WIDTH = 280

export function TextSelectionPopup() {
  const { selection } = useTextSelection()

  if (!selection) return null

  return (
    <div
      id="text-selection-popup"
      className={`${styles.popup} ${styles[selection.placement]} ${styles[selection.align]}`}
      style={{ top: selection.y, left: selection.x, width: POPUP_WIDTH }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {selection.placement === 'bottom' && <div className={styles.arrow} />}

      <div className={styles.content}>
        <p className={styles.text}>{selection.text}</p>
      </div>

      {selection.placement === 'top' && <div className={styles.arrow} />}
    </div>
  )
}