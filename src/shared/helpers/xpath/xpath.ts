export function getXPath(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return getXPath(node.parentNode!) + '/text()'
  }
  if (node === document.body) return '/html/body'
  
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const siblings = Array.from(el.parentNode?.children ?? []).filter(
    s => s.tagName === el.tagName
  )
  const index = siblings.indexOf(el) + 1
  const suffix = siblings.length > 1 ? `[${index}]` : ''
  
  return `${getXPath(el.parentNode!)}/${tag}${suffix}`
}

export function resolveXPath(xpath: string): Node | null {
  try {
    const result = document.evaluate(
      xpath, document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null
    )
    return result.singleNodeValue
  } catch {
    return null
  }
}

export function highlightBookmark(bookmark: {
  text: string
  contextText: string
  offset: number
  length: number
  id: string
}): boolean {
  if (!bookmark.text) return false
  if (document.querySelector(`[data-bookmark-id="${bookmark.id}"]`)) return true

  const containers = document.querySelectorAll<HTMLElement>('[data-source-type]')

  // Use contextText (the start text node's full content) to locate the correct node.
  // Fall back to the first line of text if contextText is not set.
  const searchStr = bookmark.contextText || bookmark.text.split('\n')[0]

  for (const container of Array.from(containers)) {
    if (container.offsetParent === null) continue

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const allNodes: Text[] = []
    while (walker.nextNode()) allNodes.push(walker.currentNode as Text)

    // Find a text node that contains (or equals) our search string
    const targetNode = allNodes.find(n => {
      const tc = n.textContent ?? ''
      return tc === searchStr || tc.includes(searchStr)
    }) ?? null
    if (!targetNode?.textContent) continue

    // Position start: find where searchStr starts in this node, then add offset
    const nodeBase = targetNode.textContent.indexOf(searchStr)
    const start = (nodeBase >= 0 ? nodeBase : 0) + bookmark.offset
    const end = Math.min(start + bookmark.length, targetNode.textContent.length)
    if (end <= start) continue

    try {
      const range = document.createRange()
      range.setStart(targetNode, start)
      range.setEnd(targetNode, end)
      const mark = document.createElement('mark')
      mark.dataset.bookmarkId = bookmark.id
      mark.className = 'bookmark-highlight'
      range.surroundContents(mark)
      return true
    } catch (e) {
      console.warn('surroundContents failed:', e)
    }
  }

  return false
}