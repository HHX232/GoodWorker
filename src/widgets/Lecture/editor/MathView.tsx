'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CopyIcon, PencilIcon, SparklesIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import 'mathlive/static.css'

export interface MathEditRequest {
  latex: string
  apply: (latex: string) => void
  /** Open straight on the AI panel (the ✦ button). */
  ai?: boolean
}

/** Opens the formula editor — set by LectureEditor (node views live outside its state). */
export const mathEditBus: { open?: (req: MathEditRequest) => void } = {}

// Formulas come from DeepSeek and from the student; commands that can emit
// links or raw attributes are neutralised before mathlive renders markup.
const UNSAFE_COMMANDS = /\\(href|url|htmlData|htmlStyle|class|cssId|style|includegraphics)\b/g

export function renderLatex(latex: string, inline: boolean): Promise<string | null> {
  return import('mathlive').then(({ convertLatexToMarkup }) => {
    try {
      return convertLatexToMarkup((latex || '\\square').replace(UNSAFE_COMMANDS, '\\text'), { defaultMode: inline ? 'inline-math' : 'math' })
    } catch {
      return null
    }
  })
}

/** Rendered formula (mathlive markup). Shared by the node view, the AI diff and the formula dialog. */
export function MathMarkup({ latex, inline }: { latex: string; inline: boolean }) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    renderLatex(latex, inline).then(h => { if (!cancelled) setHtml(h) })
    return () => { cancelled = true }
  }, [latex, inline])
  return html ? <span className="lecture-math-render" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{latex}</code>
}

/**
 * Inline formula: a quiet pill in the text line. Block formula: a card with
 * the formula centred and, on hover/selection, actions — ✦ AI, edit, copy
 * LaTeX. Double-click edits either.
 */
export function MathView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useTranslations('lecture')
  const latex = String(node.attrs.latex ?? '')
  const inline = node.type.name === 'mathInline'
  const editable = editor.isEditable

  const open = (ai = false) => {
    if (!editable) return
    mathEditBus.open?.({ latex, ai, apply: next => updateAttributes({ latex: next }) })
  }

  if (inline) {
    return (
      <NodeViewWrapper as="span" className={`lecture-math lecture-math-inline ${selected ? 'is-selected' : ''}`} onDoubleClick={() => open()} data-latex={latex} title={latex}>
        <MathMarkup latex={latex} inline />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="div" className={`lecture-math lecture-math-block ${selected ? 'is-selected' : ''}`} data-latex={latex} onDoubleClick={() => open()}>
      <div className="lecture-math-body" contentEditable={false}>
        <MathMarkup latex={latex} inline={false} />
      </div>
      {editable && (
        <div className="lecture-math-actions" contentEditable={false}>
          <button type="button" className="lecture-math-ai" onClick={() => open(true)}><SparklesIcon size={13} /> {t('formulaAi')}</button>
          <button type="button" onClick={() => open()} aria-label={t('formulaEdit')} title={t('formulaEdit')}><PencilIcon size={13} /></button>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(latex).then(() => toast.success(t('latexCopied'))).catch(() => {}) }} aria-label={t('copyLatex')} title={t('copyLatex')}><CopyIcon size={13} /></button>
        </div>
      )}
    </NodeViewWrapper>
  )
}
