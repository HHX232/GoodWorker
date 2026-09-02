// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TiptapNode = any

function nodeToText(node: TiptapNode): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'selectGap') {
    const options: string[] = node.attrs?.options ?? []
    return options.length ? `[___ (${options.join(' / ')})]` : '[___]'
  }
  if (node.type === 'inputGap') return '[___]'

  const children: string = (node.content ?? []).map(nodeToText).join('')

  if (node.type === 'paragraph' || node.type === 'heading') return `${children}\n`
  if (node.type === 'hardBreak') return '\n'
  return children
}

export function tiptapToPlainText(doc: object | null | undefined): string {
  if (!doc) return ''
  const root = doc as { content?: TiptapNode[] }
  return (root.content ?? []).map(nodeToText).join('').trim()
}
