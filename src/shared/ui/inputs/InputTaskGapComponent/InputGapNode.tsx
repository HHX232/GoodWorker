// features/test-block-editor/ui/editors/FillText/InputGapNode.ts
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { InputTaskGapComponent } from './InputTaskGapComponent'

export const InputTaskGapNode = Node.create({
  name: 'inputGap',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      answer: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'input-gap' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['input-gap', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InputTaskGapComponent)
  },
})