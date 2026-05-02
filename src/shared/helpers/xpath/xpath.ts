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

  const sourceContainers = document.querySelectorAll<HTMLElement>(
    `[data-source-type="post"][data-source-id="${bookmark.id.slice(0, 8)}"]`  // нет, используем sourceId
  )
  
  const containers = document.querySelectorAll<HTMLElement>('[data-source-type]')
  
  for (const container of Array.from(containers)) {
    if (container.offsetParent === null) continue

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const allNodes: Text[] = []
    while (walker.nextNode()) allNodes.push(walker.currentNode as Text)

    const targetNode = allNodes.find(n => n.textContent?.includes(bookmark.text)) ?? null
    if (!targetNode?.textContent) continue

    const localOffset = targetNode.textContent.indexOf(bookmark.text)
    if (localOffset === -1) continue

    try {
      const range = document.createRange()
      range.setStart(targetNode, localOffset)
      range.setEnd(targetNode, localOffset + bookmark.text.length)

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