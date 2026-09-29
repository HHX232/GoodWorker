'use client'

import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  BoldIcon, Heading2Icon, Heading3Icon, ItalicIcon, ListIcon, ListOrderedIcon, QuoteIcon, RedoIcon, SigmaIcon, SquareFunctionIcon, StrikethroughIcon, UnderlineIcon, UndoIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { mathEditBus } from '../editor/MathView'
import styles from '../LectureWorkspace/LectureWorkspace.module.scss'

/** Right-column "Текст" block — round tool buttons after the Scribe reference. */
export function FormatPanel({ editor }: { editor: Editor | null }) {
  const t = useTranslations('lecture')
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    } : null,
  })
  if (!editor) return null

  const insertFormula = (block: boolean) => {
    const { from, to, empty } = editor.state.selection
    const seed = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    mathEditBus.open?.({
      latex: seed,
      apply: latex => { if (latex) editor.chain().focus().insertContentAt({ from, to }, { type: block ? 'mathBlock' : 'mathInline', attrs: { latex } }).run() },
    })
  }

  const tools: { key: string; icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; run: () => void }[] = [
    { key: 'b', icon: <BoldIcon size={17} />, label: t('bold'), active: s?.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'i', icon: <ItalicIcon size={17} />, label: t('italic'), active: s?.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'u', icon: <UnderlineIcon size={17} />, label: t('underline'), active: s?.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { key: 's', icon: <StrikethroughIcon size={17} />, label: t('strike'), active: s?.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { key: 'h2', icon: <Heading2Icon size={17} />, label: t('heading2'), active: s?.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', icon: <Heading3Icon size={17} />, label: t('heading3'), active: s?.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'ul', icon: <ListIcon size={17} />, label: t('bulletList'), active: s?.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'ol', icon: <ListOrderedIcon size={17} />, label: t('orderedList'), active: s?.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'q', icon: <QuoteIcon size={17} />, label: t('quote'), active: s?.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: 'fi', icon: <SigmaIcon size={17} />, label: t('formulaInline'), run: () => insertFormula(false) },
    { key: 'fb', icon: <SquareFunctionIcon size={17} />, label: t('formulaBlock'), run: () => insertFormula(true) },
    { key: 'un', icon: <UndoIcon size={17} />, label: t('undo'), disabled: !s?.canUndo, run: () => editor.chain().focus().undo().run() },
    { key: 're', icon: <RedoIcon size={17} />, label: t('redo'), disabled: !s?.canRedo, run: () => editor.chain().focus().redo().run() },
  ]

  return (
    <div className={styles.toolGrid} role="toolbar" aria-label={t('toolbar')}>
      {tools.map(tool => (
        <button key={tool.key} type="button" className={styles.roundTool} aria-pressed={!!tool.active} disabled={tool.disabled} onMouseDown={e => e.preventDefault()} onClick={tool.run}>
          <span className={`${styles.roundIcon} ${tool.active ? styles.roundIconOn : ''}`}>{tool.icon}</span>
          <span className={styles.roundLabel}>{tool.label}</span>
        </button>
      ))}
    </div>
  )
}
