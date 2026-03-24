'use client'

import { OFFSET, POPUP_HEIGHT, POPUP_WIDTH } from '@/shared/constants/providers/textSelection.const'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { TextSelectionPopup } from '../../TextSelectionPopup/TextSelectionPopup'

interface SelectionState {
  text: string
  x: number
  y: number
  placement: 'top' | 'bottom'
  align: 'left' | 'center' | 'right'
}

interface TextSelectionContextType {
  selection: SelectionState | null
}

const TextSelectionContext = createContext<TextSelectionContextType>({ selection: null })

export const useTextSelection = () => useContext(TextSelectionContext)


function calcPosition(rect: DOMRect): Pick<SelectionState, 'x' | 'y' | 'placement' | 'align'> {
  const vw = window.innerWidth
  const centerX = rect.left + rect.width / 2
  const fitsTop = rect.top - POPUP_HEIGHT - OFFSET >= 0
  const placement = fitsTop ? 'top' : 'bottom'

  const y = placement === 'top'
    ? rect.top + window.scrollY - POPUP_HEIGHT - OFFSET
    : rect.bottom + window.scrollY + OFFSET

  let x = centerX - POPUP_WIDTH / 2 + window.scrollX
  let align: SelectionState['align'] = 'center'

  if (x < OFFSET) {
    x = rect.left + window.scrollX
    align = 'left'
  } else if (x + POPUP_WIDTH > vw - OFFSET) {
    x = rect.right + window.scrollX - POPUP_WIDTH
    align = 'right'
  }

  return { x, y, placement, align }
}

export function TextSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectionState | null>(null)

  useEffect(() => {
    const handleSelectionEnd = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null)
        return
      }
      const text = sel.toString().trim()
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      const { x, y, placement, align } = calcPosition(rect)
      setSelection({ text, x, y, placement, align })
    }

    const handleSelectionStart = () => setSelection(null)

    // Скрываем при скролле любого элемента, кроме самого попапа
    const handleScroll = (e: Event) => {
      const popup = document.getElementById('text-selection-popup')
      if (popup && popup.contains(e.target as Node)) return
      setSelection(null)
    }

    document.addEventListener('mousedown', handleSelectionStart)
    document.addEventListener('mouseup', handleSelectionEnd)
    document.addEventListener('touchend', handleSelectionEnd)
    // capture: true — ловим скролл на всех элементах, включая div с overflow
    window.addEventListener('scroll', handleScroll, { capture: true })

    return () => {
      document.removeEventListener('mousedown', handleSelectionStart)
      document.removeEventListener('mouseup', handleSelectionEnd)
      document.removeEventListener('touchend', handleSelectionEnd)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [])

  return (
    <TextSelectionContext.Provider value={{ selection }}>
      {children}
      <TextSelectionPopup />
    </TextSelectionContext.Provider>
  )
}