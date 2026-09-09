'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import 'mathlive/static.css'
import styles from './FormulaKeyboard.module.scss'

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5c.4 3.2 1 5.6 1.9 7.1 1 1.6 2.7 2.7 5.1 3.4-2.4.7-4.1 1.8-5.1 3.4-.9 1.5-1.5 3.9-1.9 7.1-.4-3.2-1-5.6-1.9-7.1-1-1.6-2.7-2.7-5.1-3.4 2.4-.7 4.1-1.8 5.1-3.4.9-1.5 1.5-3.9 1.9-7.1z"
        fill="currentColor"
      />
      <path
        d="M19 3c.2 1.3.5 2.3.9 2.9.4.6 1.1 1.1 2.1 1.4-1 .3-1.7.8-2.1 1.4-.4.6-.7 1.6-.9 2.9-.2-1.3-.5-2.3-.9-2.9-.4-.6-1.1-1.1-2.1-1.4 1-.3 1.7-.8 2.1-1.4.4-.6.7-1.6.9-2.9z"
        fill="currentColor"
      />
    </svg>
  )
}

interface Props {
  initialLatex?: string
  onInsert: (latex: string, dataUrl: string, width: number, height: number) => void
  onClose: () => void
  roomName?: string
  isVip?: boolean
}

export function FormulaKeyboard({ initialLatex, onInsert, onClose, roomName, isVip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<{ value: string; focus: () => void } | null>(null)
  const [ready, setReady] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialLatex?.trim())
  const [inserting, setInserting] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

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

  const handleAiToggle = useCallback(() => {
    if (!isVip) {
      toast.error('Генерация формул ИИ доступна только для VIP')
      return
    }
    setAiOpen(v => !v)
  }, [isVip])

  const handleGenerate = useCallback(async () => {
    const description = aiPrompt.trim()
    if (!description || generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/whiteboard/formula-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (fieldRef.current) {
        fieldRef.current.value = data.latex
        setIsEmpty(!data.latex?.trim())
      }
      setAiOpen(false)
      setAiPrompt('')
    } catch (err) {
      console.error('[FormulaKeyboard] AI generate failed:', err)
      toast.error('Не удалось сгенерировать формулу')
    } finally {
      setGenerating(false)
    }
  }, [aiPrompt, generating, roomName])

  return (
    <div className={styles.panel}>
      <div className={styles.field} ref={containerRef} />

      <div className={styles.aiRow}>
        <button type="button" className={styles.aiToggle} onClick={handleAiToggle}>
          <SparklesIcon />
          ИИ
          {!isVip && <span className={styles.vipBadge}>VIP</span>}
        </button>
      </div>
      {aiOpen && (
        <div className={styles.aiPanel}>
          <input
            className={styles.aiInput}
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') handleGenerate()
            }}
            placeholder="Опишите формулу…"
            maxLength={200}
            autoFocus
          />
          <button
            type="button"
            className={styles.aiGenerate}
            onClick={handleGenerate}
            disabled={!aiPrompt.trim() || generating}
          >
            {generating ? '…' : 'Сгенерировать'}
          </button>
        </div>
      )}

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
