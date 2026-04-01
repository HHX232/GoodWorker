// SelectGapNode.ts
import {Node, mergeAttributes} from '@tiptap/core'
import {ReactNodeViewRenderer} from '@tiptap/react'
import {SelectTaskGapComponent} from './SelectTaskGapComponent'

export const SelectTaskGapNode = Node.create<{onChangeAnswer?: (gapId: string, value: string) => void}>({
  name: 'selectGap',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {onChangeAnswer: undefined}
  },

  addAttributes() {
    return {
      gapId: {default: () => crypto.randomUUID()},
      options: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-options') ?? '[]')
          } catch {
            return []
          }
        },
        renderHTML: (attrs) => ({'data-options': JSON.stringify(attrs.options)})
      },
      correctOption: {default: ''}
    }
  },

  parseHTML() {
    return [{tag: 'select-gap'}]
  },

  renderHTML({HTMLAttributes}) {
    return ['select-gap', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SelectTaskGapComponent)
  }
})
