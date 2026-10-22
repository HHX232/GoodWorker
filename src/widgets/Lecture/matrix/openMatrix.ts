import { parseMatrixLatex } from '@/shared/lib/lecture/matrix'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { mathEditBus } from '../editor/MathView'
import { matrixEditBus } from './MatrixDialog'

/**
 * Opens the matrix tool for the formula at `pos` (edit it, keep its size and
 * alignment) or, with `pos === null`, for a new matrix at the cursor. The
 * toolbar button, the formula's pencil and double-click all come through here,
 * so editing a matrix always brings its operations along.
 */
export function openMatrix(editor: Editor, pos: number | null): void {
  const node = pos !== null ? editor.state.doc.nodeAt(pos) : null
  const latex = node ? String(node.attrs.latex ?? '') : ''
  const initial = node ? parseMatrixLatex(latex) : null

  const insertAfter = (at: number, next: string) =>
    editor.chain().focus().insertContentAt(Math.min(at, editor.state.doc.content.size), { type: 'mathBlock', attrs: { latex: next } }).run()

  matrixEditBus.open?.({
    initial,
    onApply: next => {
      if (node && pos !== null && initial) {
        editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...tr.doc.nodeAt(pos)?.attrs, latex: next }); return true }).run()
        return
      }
      const sel = editor.state.selection
      if (sel instanceof NodeSelection) insertAfter(sel.to, next)
      else editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: next } }).run()
    },
    // A computed result goes in as its own formula block right after the matrix (or the cursor's block).
    onInsertResult: next => {
      const current = pos !== null ? editor.state.doc.nodeAt(pos) : null
      if (current && pos !== null) { insertAfter(pos + current.nodeSize, next); return }
      const sel = editor.state.selection
      insertAfter(sel instanceof NodeSelection ? sel.to : sel.$to.after(1), next)
    },
    onEditAsFormula: node && pos !== null
      ? () => mathEditBus.open?.({
          latex,
          apply: next => editor.chain().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...tr.doc.nodeAt(pos)?.attrs, latex: next }); return true }).run(),
        })
      : undefined,
  })
}

/** Is this formula a matrix the tool can open? */
export function isMatrixFormula(latex: string): boolean {
  return parseMatrixLatex(latex) !== null
}
