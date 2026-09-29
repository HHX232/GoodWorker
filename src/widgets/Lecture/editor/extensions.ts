import { Mark, mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathView } from './MathView'

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
      return { latex: { default: '', parseHTML: el => el.getAttribute('data-latex') ?? '', renderHTML: a => ({ 'data-latex': a.latex }) } }
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
