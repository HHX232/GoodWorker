'use client'

import { useBookmarks } from '@/features/hooks/Bookmark/useBookmarks'
import { useTextSelection } from '../Providers/TextSelectionProvider/TextSelectionProvider'
import styles from './TextSelectionPopup.module.scss'

const POPUP_WIDTH = 280

export function TextSelectionPopup() {
  const { selection, clearSelection } = useTextSelection()
  const { save } = useBookmarks(
    selection?.sourceType ?? 'post',
    selection?.sourceId ?? ''
  )

  if (!selection) return null

  const canSave = !!selection.sourceType && !!selection.sourceId

  const handleSave = async () => {
  if (!canSave) {
    console.log('cannot saves')
    return}
  
  console.log('clicking save', {
    sourceType: selection.sourceType,
    sourceId: selection.sourceId,
    text: selection.text,
    xpath: selection.xpath,
    offset: selection.offset,
    length: selection.length,
  })

  const res = await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: selection.sourceType,
      sourceId: selection.sourceId,
      text: selection.text,
      xpath: selection.xpath,
      offset: selection.offset,
       contextText: selection.contextText, 
      length: selection.length,
    })
  })

  console.log('response status:', res.status)
  const data = await res.json()
  console.log('response data:', data)
  
  clearSelection()
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

        {canSave && (
          <button className={styles.save_btn} onClick={handleSave} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Сохранить закладку
          </button>
        )}
      </div>

      {selection.placement === 'top' && <div className={styles.arrow} />}
    </div>
  )
}