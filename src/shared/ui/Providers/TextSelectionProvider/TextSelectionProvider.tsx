'use client'

import { OFFSET, POPUP_HEIGHT, POPUP_WIDTH } from '@/shared/constants/providers/textSelection.const'
import { getXPath } from '@/shared/helpers/xpath/xpath'
import { usePathname } from 'next/navigation'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { TextSelectionPopup } from '../../TextSelectionPopup/TextSelectionPopup'

interface SelectionState {
  text: string
  x: number
  y: number
  placement: 'top' | 'bottom'
  align: 'left' | 'center' | 'right'
  xpath: string
  offset: number
  length: number
  sourceType: 'post' | null
  sourceId: string | null
  contextText:string
}

interface TextSelectionContextType {
  selection: SelectionState | null
  clearSelection: () => void
}

const TextSelectionContext = createContext<TextSelectionContextType>({
  selection: null,
  clearSelection: () => {},
})

export const useTextSelection = () => useContext(TextSelectionContext)

function calcPosition(rect: DOMRect): Pick<SelectionState, 'x' | 'y' | 'placement' | 'align'> {
  const vw = window.innerWidth
  const centerX = rect.left + rect.width / 2
  const fitsTop = rect.top - POPUP_HEIGHT - OFFSET >= 0
  const placement = fitsTop ? 'top' : 'bottom'

  const y =
    placement === 'top'
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

// Ищем ближайший элемент с data-source-type и data-source-id
function findSource(node: Node): { sourceType: 'post' | null; sourceId: string | null } {
  let el: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE
      ? (node.parentElement)
      : (node as HTMLElement)

  while (el) {
    console.log('findSource checking:', el.tagName, el.dataset)
    const sourceType = el.dataset.sourceType as 'post' | undefined
    const sourceId = el.dataset.sourceId
    if (sourceType && sourceId) return { sourceType, sourceId }
    el = el.parentElement
  }

  return { sourceType: null, sourceId: null }
}

export function TextSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const pathname = usePathname()
  const isDisabled = pathname.startsWith('/create-post') || pathname.startsWith('/teacher/posts')

  const clearSelection = useCallback(() => setSelection(null), [])

  useEffect(() => {
    if (isDisabled) {
      setSelection(null)
      return
    }

    const handleSelectionEnd = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null)
        return
      }

      const text = sel.toString().trim()
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const container = range.startContainer
const contextText = container.nodeType === Node.TEXT_NODE
  ? (container.textContent ?? '')
  : (container as HTMLElement).innerText ?? ''

      if (rect.width === 0 && rect.height === 0) return

      const xpath = getXPath(range.startContainer)
      const offset = range.startOffset
      const length = text.length
      const { sourceType, sourceId } = findSource(range.startContainer)
      const { x, y, placement, align } = calcPosition(rect)

   setSelection({ 
  text, x, y, placement, align, 
  xpath: '', 
  offset: range.startOffset, 
  length: text.length, 
  sourceType, sourceId,
  contextText 
})
    }

const handleSelectionStart = (e: MouseEvent) => {
  const popup = document.getElementById('text-selection-popup')
  if (popup && popup.contains(e.target as Node)) return // ← добавь это
  setSelection(null)
}
    const handleScroll = (e: Event) => {
      const popup = document.getElementById('text-selection-popup')
      if (popup && popup.contains(e.target as Node)) return
      setSelection(null)
    }

    document.addEventListener('mousedown', handleSelectionStart)
    document.addEventListener('mouseup', handleSelectionEnd)
    document.addEventListener('touchend', handleSelectionEnd)
    window.addEventListener('scroll', handleScroll, { capture: true })

    return () => {
      document.removeEventListener('mousedown', handleSelectionStart)
      document.removeEventListener('mouseup', handleSelectionEnd)
      document.removeEventListener('touchend', handleSelectionEnd)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [isDisabled])

  return (
    <TextSelectionContext.Provider value={{ selection, clearSelection }}>
      {children}
     
      {!isDisabled && <TextSelectionPopup />}
    </TextSelectionContext.Provider>
  )
}