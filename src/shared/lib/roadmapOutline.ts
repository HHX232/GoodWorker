import { RoadMapBlockType } from '@/shared/types/RoadMap/RoadMap.types'

export interface OutlineStep {
  number: string
  title: string
  nodeId: string
  depth: number
  type: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNodeTitle(node: any): string {
  const type: RoadMapBlockType = node.data?.type
  const inputs: Record<string, string> = node.data?.inputs ?? {}

  switch (type) {
    case RoadMapBlockType.INFO_TEXT: {
      const raw = inputs[RoadMapBlockType.INFO_TEXT] ?? inputs['text'] ?? ''
      const stripped = raw.replace(/<[^>]*>/g, '').trim()
      return stripped.slice(0, 80) || 'Text'
    }
    case RoadMapBlockType.INFO_MEDIA:
      return 'Media'
    case RoadMapBlockType.INFO_AUDIO:
      return 'Audio'
    case RoadMapBlockType.DOWNLOAD_FILE_LINK: {
      const files: { name: string }[] = node.data?.uploadedFiles ?? []
      if (files.length === 1) return files[0].name
      return files.length > 1 ? `Files (${files.length})` : 'Files'
    }
    case RoadMapBlockType.POST_LINK:
      return 'Posts'
    case RoadMapBlockType.ACTIVE_TEST:
    case RoadMapBlockType.TEST_LINK:
      return 'Test'
    case RoadMapBlockType.ACTIVE_COMMENT:
      return 'Feedback'
    case RoadMapBlockType.DIVIDER: {
      const label = inputs['text'] ?? inputs['label'] ?? ''
      return label.trim() || ''
    }
    default:
      return type ?? 'Block'
  }
}

export function generateAutoOutline(content: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[]
}): OutlineStep[] {
  const { nodes, edges } = content

  // Build adjacency map: source → children
  const childMap = new Map<string, string[]>()
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    if (!childMap.has(edge.source)) childMap.set(edge.source, [])
    childMap.get(edge.source)!.push(edge.target)
  }

  const entryNode = nodes.find((n) => n.data?.type === RoadMapBlockType.ENTRY_POINT)
  if (!entryNode) return []

  // DFS from entry point (respects edge ordering)
  const visited = new Set<string>()
  const ordered: typeof nodes = []

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (node) ordered.push(node)
    for (const childId of childMap.get(nodeId) ?? []) {
      visit(childId)
    }
  }

  visit(entryNode.id)

  const steps: OutlineStep[] = []
  let topLevel = 0
  let sub = 0
  let inSection = false

  for (const node of ordered) {
    const type: RoadMapBlockType = node.data?.type
    if (type === RoadMapBlockType.ENTRY_POINT) continue

    if (type === RoadMapBlockType.DIVIDER) {
      topLevel++
      sub = 0
      inSection = true
      const title = getNodeTitle(node) || `Section ${topLevel}`
      steps.push({ number: String(topLevel), title, nodeId: node.id, depth: 0, type })
    } else {
      if (!inSection) {
        // No divider yet — treat as top-level
        topLevel++
        steps.push({ number: String(topLevel), title: getNodeTitle(node), nodeId: node.id, depth: 0, type })
      } else {
        sub++
        steps.push({
          number: `${topLevel}.${sub}`,
          title: getNodeTitle(node),
          nodeId: node.id,
          depth: 1,
          type,
        })
      }
    }
  }

  return steps
}
