// InputGapNode.ts
import {Node, mergeAttributes} from '@tiptap/core'
import {ReactNodeViewRenderer} from '@tiptap/react'
import {InputTaskGapComponent} from './InputTaskGapComponent'

export const InputTaskGapNode = Node.create<{onChangeAnswer?: (gapId: string, value: string) => void}>({
  name: 'inputGap',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {onChangeAnswer: undefined}
  },

  addAttributes() {
    return {
      gapId: {default: () => crypto.randomUUID()},
      answer: {default: ''}
    }
  },

  parseHTML() {
    return [{tag: 'input-gap'}]
  },

  renderHTML({HTMLAttributes}) {
    return ['input-gap', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InputTaskGapComponent)
  }
})
