// shared/ui/inputs/SelectTaskGapComponent/SelectGapNode.ts
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { SelectTaskGapComponent } from './SelectTaskGapComponent'

export const SelectTaskGapNode = Node.create({
  name: 'selectGap',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      options: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-options') ?? '[]')
          } catch {
            return []
          }
        },
        renderHTML: (attrs) => ({
          'data-options': JSON.stringify(attrs.options),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'select-gap' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['select-gap', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SelectTaskGapComponent)
  },
})