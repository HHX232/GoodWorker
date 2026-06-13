import { RoadMapBlockType } from '@/shared/types/RoadMap/RoadMap.types'

export interface OutlineStep {
  number: string
  title: string
  nodeId: string
  depth: number
  type: string
}

const TYPE_LABELS: Record<string, Record<string, string>> = {
  ru: { text: 'Текст', media: 'Медиа', audio: 'Аудио', files: 'Файлы', posts: 'Посты', test: 'Тест', feedback: 'Обратная связь' },
  en: { text: 'Text',  media: 'Media', audio: 'Audio', files: 'Files', posts: 'Posts', test: 'Test', feedback: 'Feedback' },
  hi: { text: 'टेक्स्ट', media: 'मीडिया', audio: 'ऑडियो', files: 'फ़ाइलें', posts: 'पोस्ट', test: 'परीक्षण', feedback: 'प्रतिक्रिया' },
  zh: { text: '文本', media: '媒体', audio: '音频', files: '文件', posts: '帖子', test: '测验', feedback: '反馈' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNodeTitle(node: any, lang = 'ru'): string {
  const type: RoadMapBlockType = node.data?.type
  const inputs: Record<string, string> = node.data?.inputs ?? {}
  const L = TYPE_LABELS[lang] ?? TYPE_LABELS['ru']

  switch (type) {
    case RoadMapBlockType.INFO_TEXT: {
      const raw = inputs[RoadMapBlockType.INFO_TEXT] ?? inputs['text'] ?? ''
      const stripped = raw.replace(/<[^>]*>/g, '').trim()
      return stripped.slice(0, 80) || L.text
    }
    case RoadMapBlockType.INFO_MEDIA:
      return L.media
    case RoadMapBlockType.INFO_AUDIO:
      return L.audio
    case RoadMapBlockType.DOWNLOAD_FILE_LINK: {
      const files: { name: string }[] = node.data?.uploadedFiles ?? []
      if (files.length === 1) return files[0].name
      return files.length > 1 ? `${L.files} (${files.length})` : L.files
    }
    case RoadMapBlockType.POST_LINK:
      return L.posts
    case RoadMapBlockType.ACTIVE_TEST:
    case RoadMapBlockType.TEST_LINK:
      return L.test
    case RoadMapBlockType.ACTIVE_COMMENT:
      return L.feedback
    case RoadMapBlockType.DIVIDER: {
      const outputs: { name?: string }[] = node.data?.outputs ?? []
      const outputName = outputs[0]?.name?.trim() ?? ''
      return outputName || ''
    }
    default:
      return type ?? L.text
  }
}

export function generateAutoOutline(content: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[]
}, lang = 'ru'): OutlineStep[] {
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
      const sectionFallback = { ru: 'Раздел', en: 'Section', hi: 'अनुभाग', zh: '章节' }[lang] ?? 'Section'
      const title = getNodeTitle(node, lang) || `${sectionFallback} ${topLevel}`
      steps.push({ number: String(topLevel), title, nodeId: node.id, depth: 0, type })
    } else {
      if (!inSection) {
        // No divider yet — treat as top-level
        topLevel++
        steps.push({ number: String(topLevel), title: getNodeTitle(node, lang), nodeId: node.id, depth: 0, type })
      } else {
        sub++
        steps.push({
          number: `${topLevel}.${sub}`,
          title: getNodeTitle(node, lang),
          nodeId: node.id,
          depth: 1,
          type,
        })
      }
    }
  }

  return steps
}
