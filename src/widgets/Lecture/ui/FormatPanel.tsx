'use client'

import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { useEditorState } from '@tiptap/react'
import {
  AArrowDownIcon, AArrowUpIcon, AlignCenterIcon, AlignJustifyIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, Grid3x3Icon, Heading2Icon, LineChartIcon, PresentationIcon, Heading3Icon, ItalicIcon, ListIcon, ListOrderedIcon, QuoteIcon, RedoIcon, SigmaIcon, SquareFunctionIcon, StrikethroughIcon, UnderlineIcon, UndoIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { mathEditBus } from '../editor/MathView'
import { stepMathSize, type MathAlign } from '../editor/extensions'
import { openMatrix } from '../matrix/openMatrix'
import styles from '../LectureWorkspace/LectureWorkspace.module.scss'

/** Text sizes offered in the panel ('' = the page's normal size). */
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'] as const
const BASE_SIZE = '16px'

/** A selected formula: its position, scale and (block only) alignment. */
function mathSelection(e: Editor): { pos: number; size: number; align: MathAlign | null } | null {
  const sel = e.state.selection
  if (!(sel instanceof NodeSelection) || (sel.node.type.name !== 'mathInline' && sel.node.type.name !== 'mathBlock')) return null
  return { pos: sel.from, size: Number(sel.node.attrs.size) || 1, align: sel.node.type.name === 'mathBlock' ? (sel.node.attrs.align ?? 'center') : null }
}

/**
 * Right-column "Текст" block — round tool buttons after the Scribe reference.
 * `compact`: one slim row of icon buttons (the public link page's toolbar).
 */
export function FormatPanel({ editor, compact = false }: { editor: Editor | null; compact?: boolean }) {
  const t = useTranslations('lecture')
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
      fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      align: (['center', 'right', 'justify'] as const).find(a => e.isActive({ textAlign: a })) ?? 'left',
      math: mathSelection(e),
    } : null,
  })
  if (!editor) return null

  /** A selected matrix formula opens for editing; otherwise a new one goes in at the cursor. */
  const openMatrixTool = () => {
    const sel = editor.state.selection
    const onFormula = sel instanceof NodeSelection && (sel.node.type.name === 'mathBlock' || sel.node.type.name === 'mathInline')
    openMatrix(editor, onFormula ? sel.from : null)
  }
  /** A block goes in at the cursor — or after a selected graph/board/formula, never over it. */
  const insertBlock = (node: { type: string; attrs?: Record<string, unknown> }) => {
    const sel = editor.state.selection
    if (sel instanceof NodeSelection) editor.chain().focus().insertContentAt(sel.to, node).run()
    else editor.chain().focus().insertContent(node).run()
  }

  const insertFormula = (block: boolean) => {
    const { from, to, empty } = editor.state.selection
    const seed = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    mathEditBus.open?.({
      latex: seed,
      apply: latex => { if (latex) editor.chain().focus().insertContentAt({ from, to }, { type: block ? 'mathBlock' : 'mathInline', attrs: { latex } }).run() },
    })
  }

  // Size/alignment act on a selected formula when there is one, otherwise on the text.
  const setMathAttrs = (attrs: Record<string, unknown>) => {
    const m = s?.math
    if (!m) return
    editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(m.pos, undefined, { ...tr.doc.nodeAt(m.pos)?.attrs, ...attrs }); return true }).setNodeSelection(m.pos).run()
  }
  const stepSize = (dir: 1 | -1) => {
    if (s?.math) { setMathAttrs({ size: stepMathSize(s.math.size, dir) }); return }
    const i = FONT_SIZES.indexOf((s?.fontSize || BASE_SIZE) as typeof FONT_SIZES[number])
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, (i < 0 ? FONT_SIZES.indexOf(BASE_SIZE) : i) + dir))]
    if (next === BASE_SIZE) editor.chain().focus().unsetFontSize().run()
    else editor.chain().focus().setFontSize(next).run()
  }
  const setSize = (v: string) => {
    if (!v || v === BASE_SIZE) editor.chain().focus().unsetFontSize().run()
    else editor.chain().focus().setFontSize(v).run()
  }
  const setAlign = (a: MathAlign | 'justify') => {
    if (s?.math) { if (s.math.align && a !== 'justify') setMathAttrs({ align: a }); return }
    if (a === 'left') editor.chain().focus().unsetTextAlign().run()
    else editor.chain().focus().setTextAlign(a).run()
  }
  const currentAlign = s?.math ? s.math.align : s?.align

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
    { key: 'board', icon: <PresentationIcon size={17} />, label: t('board'), run: () => insertBlock({ type: 'boardBlock' }) },
    { key: 'graph', icon: <LineChartIcon size={17} />, label: t('graph'), run: () => insertBlock({ type: 'graphBlock', attrs: { fresh: true } }) },
    { key: 'matrix', icon: <Grid3x3Icon size={17} />, label: t('matrix'), run: openMatrixTool },
    { key: 'un', icon: <UndoIcon size={17} />, label: t('undo'), disabled: !s?.canUndo, run: () => editor.chain().focus().undo().run() },
    { key: 're', icon: <RedoIcon size={17} />, label: t('redo'), disabled: !s?.canRedo, run: () => editor.chain().focus().redo().run() },
  ]

  return (
    <div className={compact ? styles.formatCompact : styles.formatStack}>
    <div className={styles.sizeBar} role="toolbar" aria-label={t('sizeAndAlign')}>
      <button type="button" className={styles.sizeBtn} onMouseDown={e => e.preventDefault()} onClick={() => stepSize(-1)} aria-label={t('sizeDown')} title={t('sizeDown')}><AArrowDownIcon size={16} /></button>
      {s?.math
        ? <span className={styles.sizeValue} title={t('formulaSize')}>{Math.round(s.math.size * 100)}%</span>
        : (
          <select className={styles.sizeSelect} value={s?.fontSize || BASE_SIZE} onChange={e => setSize(e.target.value)} aria-label={t('fontSize')}>
            {FONT_SIZES.map(v => <option key={v} value={v}>{v === BASE_SIZE ? `${parseInt(v)} · ${t('fontSizeNormal')}` : parseInt(v)}</option>)}
            {s?.fontSize && !FONT_SIZES.includes(s.fontSize as typeof FONT_SIZES[number]) && <option value={s.fontSize}>{s.fontSize}</option>}
          </select>
        )}
      <button type="button" className={styles.sizeBtn} onMouseDown={e => e.preventDefault()} onClick={() => stepSize(1)} aria-label={t('sizeUp')} title={t('sizeUp')}><AArrowUpIcon size={16} /></button>
      <span className={styles.sizeSep} />
      {([['left', AlignLeftIcon, 'alignLeft'], ['center', AlignCenterIcon, 'alignCenter'], ['right', AlignRightIcon, 'alignRight'], ['justify', AlignJustifyIcon, 'alignJustify']] as const).map(([a, Icon, key]) => (
        <button
          key={a}
          type="button"
          className={`${styles.sizeBtn} ${currentAlign === a ? styles.sizeBtnOn : ''}`}
          aria-pressed={currentAlign === a}
          disabled={!!s?.math && (!s.math.align || a === 'justify')}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setAlign(a)}
          aria-label={t(key)}
          title={t(key)}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
    <div className={styles.toolGrid} role="toolbar" aria-label={t('toolbar')}>
      {tools.map(tool => (
        <button key={tool.key} type="button" className={styles.roundTool} aria-pressed={!!tool.active} aria-label={tool.label} title={compact ? tool.label : undefined} disabled={tool.disabled} onMouseDown={e => e.preventDefault()} onClick={tool.run}>
          <span className={`${styles.roundIcon} ${tool.active ? styles.roundIconOn : ''}`}>{tool.icon}</span>
          <span className={styles.roundLabel}>{tool.label}</span>
        </button>
      ))}
    </div>
    </div>
  )
}
