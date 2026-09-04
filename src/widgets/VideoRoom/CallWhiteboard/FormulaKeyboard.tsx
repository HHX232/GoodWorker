'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import 'mathlive/static.css'
import styles from './FormulaKeyboard.module.scss'

interface Props {
  initialLatex?: string
  onInsert: (latex: string, dataUrl: string, width: number, height: number) => void
  onClose: () => void
}

export function FormulaKeyboard({ initialLatex, onInsert, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<{ value: string; focus: () => void } | null>(null)
  const [ready, setReady] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialLatex?.trim())
  const [inserting, setInserting] = useState(false)

  useEffect(() => {
    let field: HTMLElement & { value: string; focus: () => void }
    let cancelled = false

    import('mathlive').then(() => {
      if (cancelled || !containerRef.current) return
      field = document.createElement('math-field') as typeof field
      field.value = initialLatex ?? ''
      field.setAttribute('style', 'width: 100%; font-size: 28px; border: none;')
      field.addEventListener('input', () => setIsEmpty(!field.value.trim()))
      // Excalidraw's global tool shortcuts (digits, letters) live on a
      // document-level keydown listener that doesn't recognize this custom
      // element as "text editing" — stop the event here so typing a formula
      // (e.g. the "2" in "x^2") doesn't switch the active drawing tool.
      field.addEventListener('keydown', (e) => e.stopPropagation())
      containerRef.current.appendChild(field)
      fieldRef.current = field
      field.focus()
      window.mathVirtualKeyboard?.show()
      setReady(true)
    })

    return () => {
      cancelled = true
      window.mathVirtualKeyboard?.hide()
      field?.remove()
    }
  }, [initialLatex])

  const handleInsert = useCallback(async () => {
    const latex = fieldRef.current?.value?.trim()
    if (!latex || inserting) return
    setInserting(true)
    try {
      const [{ convertLatexToMarkup }, html2canvasModule] = await Promise.all([
        import('mathlive'),
        import('html2canvas'),
      ])
      const html2canvas = html2canvasModule.default
      const markup = convertLatexToMarkup(latex, { defaultMode: 'math' })

      const holder = document.createElement('div')
      holder.style.position = 'fixed'
      holder.style.left = '-9999px'
      holder.style.top = '0'
      holder.style.background = '#ffffff'
      holder.style.padding = '12px'
      holder.style.fontSize = '32px'
      holder.style.color = '#0a0a0a'
      holder.innerHTML = markup
      document.body.appendChild(holder)

      await document.fonts.ready
      const canvas = await html2canvas(holder, { backgroundColor: '#ffffff', scale: 2 })
      holder.remove()

      onInsert(latex, canvas.toDataURL('image/png'), canvas.width / 2, canvas.height / 2)
    } catch (err) {
      console.error('[FormulaKeyboard] insert failed:', err)
    } finally {
      setInserting(false)
    }
  }, [inserting, onInsert])

  return (
    <div className={styles.panel}>
      <div className={styles.field} ref={containerRef} />
      {!ready && <div className={styles.loading}>Загрузка клавиатуры формул…</div>}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className={styles.insert}
          onClick={handleInsert}
          disabled={isEmpty || inserting}
        >
          {inserting ? 'Вставка…' : 'Вставить на доску'}
        </button>
      </div>
    </div>
  )
}
