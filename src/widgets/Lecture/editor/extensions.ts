import { Mark, mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathView } from './MathView'
import { PhotoView } from './PhotoView'
import { BoardView } from '../board/BoardView'
import { GraphView } from '../graph/GraphView'

/** Transactions carrying this meta come from the AI (append / final regen) — they don't mark a section as edited. */
export const AI_META = 'lectureAi'

/**
 * One chunk-range of AI-written notes. `edited` flips to true the moment the
 * student changes anything inside — from then on the AI never rewrites it
 * (the final-pass refresh skips it). `final` = written from the big-model text.
 */
export const AiSection = Node.create({
  name: 'aiSection',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      fromSeq: { default: 0, parseHTML: el => Number(el.getAttribute('data-from')) || 0, renderHTML: a => ({ 'data-from': a.fromSeq }) },
      toSeq: { default: 0, parseHTML: el => Number(el.getAttribute('data-to')) || 0, renderHTML: a => ({ 'data-to': a.toSeq }) },
      edited: { default: false, parseHTML: el => el.getAttribute('data-edited') === 'true', renderHTML: a => ({ 'data-edited': String(!!a.edited) }) },
      final: { default: false, parseHTML: el => el.getAttribute('data-final') === 'true', renderHTML: a => ({ 'data-final': String(!!a.final) }) },
      startMs: { default: 0, parseHTML: el => Number(el.getAttribute('data-start')) || 0, renderHTML: a => ({ 'data-start': a.startMs }) },
    }
  },
  parseHTML() {
    return [{ tag: 'section[data-ai-section]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-ai-section': '', class: 'lecture-ai-section' }), 0]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('aiSectionEdited'),
        appendTransaction(transactions, _old, newState) {
          const userTrs = transactions.filter(tr => tr.docChanged && !tr.getMeta(AI_META))
          if (!userTrs.length) return null
          // Every position a user step touched, mapped into the new document.
          const touched: [number, number][] = []
          for (const tr of userTrs) {
            tr.mapping.maps.forEach((map, i) => {
              map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                const rest = tr.mapping.slice(i + 1)
                touched.push([rest.map(newStart, -1), rest.map(newEnd, 1)])
              })
            })
          }
          if (!touched.length) return null
          const out = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'aiSection') return true
            const end = pos + node.nodeSize
            if (!node.attrs.edited && touched.some(([a, b]) => a < end && b > pos)) {
              out.setNodeMarkup(pos, undefined, { ...node.attrs, edited: true })
              changed = true
            }
            return false
          })
          if (!changed) return null
          out.setMeta('addToHistory', false)
          return out
        },
      }),
    ]
  },
})

/** Formula sizes the −/+ steps go through (1 = text size). */
export const MATH_SIZES = [0.75, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5] as const
export type MathAlign = 'left' | 'center' | 'right'

export function stepMathSize(current: number, dir: 1 | -1): number {
  const i = MATH_SIZES.findIndex(v => v >= current - 1e-6)
  const at = i < 0 ? MATH_SIZES.length - 1 : i
  return MATH_SIZES[Math.min(MATH_SIZES.length - 1, Math.max(0, at + dir))]
}

function mathNode(name: 'mathInline' | 'mathBlock') {
  const inline = name === 'mathInline'
  return Node.create({
    name,
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: true,
    draggable: !inline,
    addAttributes() {
      return {
        latex: { default: '', parseHTML: el => el.getAttribute('data-latex') ?? '', renderHTML: a => ({ 'data-latex': a.latex }) },
        /** Scale relative to the text (MATH_SIZES). */
        size: { default: 1, parseHTML: el => Number(el.getAttribute('data-size')) || 1, renderHTML: a => (a.size === 1 ? {} : { 'data-size': a.size }) },
        // Block formulas only: where the formula sits on the line.
        ...(inline ? {} : { align: { default: 'center', parseHTML: el => el.getAttribute('data-align') ?? 'center', renderHTML: a => (a.align === 'center' ? {} : { 'data-align': a.align }) } }),
      }
    },
    parseHTML() {
      return [{ tag: inline ? 'span[data-math-inline]' : 'div[data-math-block]' }]
    },
    renderHTML({ HTMLAttributes }) {
      return [inline ? 'span' : 'div', mergeAttributes(HTMLAttributes, inline ? { 'data-math-inline': '' } : { 'data-math-block': '' })]
    },
    renderText({ node }) {
      return inline ? `$${node.attrs.latex}$` : `\n$$${node.attrs.latex}$$\n`
    },
    addNodeView() {
      return ReactNodeViewRenderer(MathView, { as: inline ? 'span' : 'div' })
    },
  })
}

export const MathInline = mathNode('mathInline')
export const MathBlock = mathNode('mathBlock')

/** A note pinned to a place in the text ("заметка на полях"). */
export const LectureNoteMark = Mark.create({
  name: 'lectureNote',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-note-id'), renderHTML: a => ({ 'data-note-id': a.id }) },
      text: { default: '', parseHTML: el => el.getAttribute('data-note') ?? '', renderHTML: a => ({ 'data-note': a.text }) },
      createdAt: { default: null, parseHTML: el => el.getAttribute('data-note-at'), renderHTML: a => ({ 'data-note-at': a.createdAt }) },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-note-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'lecture-note' }), 0]
  },
})

/** Temporary: a fragment waiting for its "fix by photo" answer — replaced (and gone) when it arrives. */
export const PendingFixMark = Mark.create({
  name: 'pendingFix',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return { id: { default: null, parseHTML: el => el.getAttribute('data-fix-id'), renderHTML: a => ({ 'data-fix-id': a.id }) } }
  },
  parseHTML() {
    return [{ tag: 'span[data-fix-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'lecture-pending-fix' }), 0]
  },
})

/** A board / notebook photo in the notes (LecturePhoto row; image served via our API). */
export const LecturePhotoNode = Node.create({
  name: 'lecturePhoto',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      photoId: { default: '', parseHTML: el => el.getAttribute('data-photo-id') ?? '', renderHTML: a => ({ 'data-photo-id': a.photoId }) },
      width: { default: 0, parseHTML: el => Number(el.getAttribute('data-w')) || 0, renderHTML: a => ({ 'data-w': a.width }) },
      height: { default: 0, parseHTML: el => Number(el.getAttribute('data-h')) || 0, renderHTML: a => ({ 'data-h': a.height }) },
      size: { default: 'full', parseHTML: el => (el.getAttribute('data-size') === 'half' ? 'half' : 'full'), renderHTML: a => ({ 'data-size': a.size }) },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-photo-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes)]
  },
  renderText() {
    return '[фото]\n'
  },
  addNodeView() {
    return ReactNodeViewRenderer(PhotoView)
  },
})

/**
 * A whiteboard between paragraphs — the call board's scene (JSON, kept for
 * later edits) plus its snapshot (a LecturePhoto: page, PDF, Word). `spec`
 * is set only on a block the AI asked for; the view builds the scene from it.
 */
export const BoardBlockNode = Node.create({
  name: 'boardBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      scene: { default: null, rendered: false },
      spec: { default: null, rendered: false },
      photoId: { default: '', parseHTML: el => el.getAttribute('data-photo-id') ?? '', renderHTML: a => ({ 'data-photo-id': a.photoId }) },
      width: { default: 0, rendered: false },
      height: { default: 0, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-board]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-board': '' })]
  },
  renderText() {
    return '[доска]\n'
  },
  addNodeView() {
    return ReactNodeViewRenderer(BoardView)
  },
})

/**
 * A function graph / chart. The spec (validated JSON) is the source of truth —
 * drawn live with recharts; `photoId` is a PNG snapshot for Word, `snapOf` the
 * spec it was taken from (a changed spec re-snapshots).
 */
export const GraphBlockNode = Node.create({
  name: 'graphBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      spec: { default: null, rendered: false },
      photoId: { default: '', parseHTML: el => el.getAttribute('data-photo-id') ?? '', renderHTML: a => ({ 'data-photo-id': a.photoId }) },
      width: { default: 0, rendered: false },
      height: { default: 0, rendered: false },
      snapOf: { default: '', rendered: false },
      /** Just inserted from the toolbar — open the editor right away (never true after a reload). */
      fresh: { default: false, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-graph]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-graph': '' })]
  },
  renderText() {
    return '[график]\n'
  },
  addNodeView() {
    return ReactNodeViewRenderer(GraphView)
  },
})
