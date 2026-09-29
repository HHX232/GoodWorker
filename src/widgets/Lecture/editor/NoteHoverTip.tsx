'use client'

import type { Editor } from '@tiptap/core'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './LectureEditor.module.scss'

interface Tip { text: string; x: number; y: number; below: boolean }

/**
 * Hovering a note shows it right above the annotated text. A note can be split
 * into several spans (other marks inside it, line wraps) — all of them light
 * up together and there is one tip, over the first line of the note.
 */
export function NoteHoverTip({ editor }: { editor: Editor }) {
  const t = useTranslations('lecture')
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    const root = editor.view.dom as HTMLElement
    let current: string | null = null
    const parts = (id: string) => [...root.querySelectorAll<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`)]

    const clear = () => {
      if (current) parts(current).forEach(el => el.classList.remove('is-hover'))
      current = null
      setTip(null)
    }
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.('[data-note-id]') as HTMLElement | null
      const id = el?.dataset.noteId ?? null
      if (id === current) return
      clear()
      if (!id || !el?.dataset.note) return
      current = id
      const spans = parts(id)
      spans.forEach(s => s.classList.add('is-hover'))
      // Anchor: the first line of the note, centred over that line's run of text.
      const rects = spans.flatMap(s => [...s.getClientRects()])
      const top = Math.min(...rects.map(r => r.top))
      const firstLine = rects.filter(r => r.top - top < 4)
      const left = Math.min(...firstLine.map(r => r.left))
      const right = Math.max(...firstLine.map(r => r.right))
      const below = top < 90
      const bottom = Math.max(...rects.map(r => r.bottom))
      setTip({ text: el.dataset.note, x: Math.max(170, Math.min(window.innerWidth - 170, (left + right) / 2)), y: below ? bottom : top, below })
    }
    const out = (e: MouseEvent) => {
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-note-id]') as HTMLElement | null
      if (!to || to.dataset.noteId !== current) clear()
    }
    root.addEventListener('mouseover', over)
    root.addEventListener('mouseout', out)
    window.addEventListener('scroll', clear, true)
    return () => {
      root.removeEventListener('mouseover', over)
      root.removeEventListener('mouseout', out)
      window.removeEventListener('scroll', clear, true)
      clear()
    }
  }, [editor])

  if (!tip) return null
  return createPortal(
    <div className={`${styles.noteTip} ${tip.below ? styles.noteTipBelow : ''}`} style={{ left: tip.x, top: tip.y }} role="tooltip">
      <span className={styles.noteTipLabel}>{t('noteTitle')}</span>
      {tip.text}
    </div>,
    document.body,
  )
}
