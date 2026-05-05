'use client'

import { useBookmarks } from '@/features/hooks/Bookmark/useBookmarks'
import { useState } from 'react'
import { useTextSelection } from '../Providers/TextSelectionProvider/TextSelectionProvider'
import styles from './TextSelectionPopup.module.scss'

const POPUP_WIDTH = 280

export function TextSelectionPopup() {
  const { selection, clearSelection } = useTextSelection()
  const { save } = useBookmarks(
    selection?.sourceType ?? 'post',
    selection?.sourceId ?? ''
  )
  const [copied, setCopied] = useState(false)

  if (!selection) return null

  const canSave = !!selection.sourceType && !!selection.sourceId

  const handleSave = async () => {
    if (!canSave) return
    try {
      await save({
        text: selection.text,
        xpath: selection.xpath,
        offset: selection.offset,
        length: selection.length,
        contextText: selection.contextText,
      })
      clearSelection()
    } catch {
      // ошибка уже показана тостом в мутации
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(selection.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

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

        <div className={styles.buttons}>
          <button className={styles.copy_btn} onClick={handleCopy} type="button">
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Скопировано
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Копировать
              </>
            )}
          </button>

          {canSave && (
            <button className={styles.save_btn} onClick={handleSave} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Сохранить
            </button>
          )}
        </div>
      </div>

      {selection.placement === 'top' && <div className={styles.arrow} />}
    </div>
  )
}
