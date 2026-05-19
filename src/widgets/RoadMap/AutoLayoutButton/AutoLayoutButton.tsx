import dagre from '@dagrejs/dagre'
import {useReactFlow} from '@xyflow/react'
import {useTranslations} from 'next-intl'
import styles from './AutoLayoutButton.module.scss'

export function AutoLayoutButton() {
  const t = useTranslations('roadMap')
  const {getNodes, getEdges, setNodes, fitView} = useReactFlow()

  const applyLayout = () => {
    const nodes = getNodes()
    const edges = getEdges()

    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))

    graph.setGraph({
      rankdir: 'LR',
      nodesep: 150,
      ranksep: 100
    })

    nodes.forEach((node) => {
      graph.setNode(node.id, {
        width: node.measured?.width ?? 350,
        height: node.measured?.height ?? 100
      })
    })

    edges.forEach((edge) => {
      graph.setEdge(edge.source, edge.target)
    })

    dagre.layout(graph)

    const layoutedNodes = nodes.map((node) => {
      const pos = graph.node(node.id)
      return {
        ...node,
        position: {
          x: pos.x - (node.measured?.width ?? 350) / 2,
          y: pos.y - (node.measured?.height ?? 100) / 2
        }
      }
    })

    setNodes(layoutedNodes)
    // Небольшая задержка чтобы fitView сработал после setNodes
    setTimeout(() => fitView({padding: 0.2, duration: 500}), 50)
  }

  return (
    <button onClick={applyLayout} className={styles.button}>
      <svg className={styles.icon} viewBox='0 0 16 16' fill='none'>
        <path
          d='M2 4h4M2 8h4M2 12h4M8 2v12M10 4h4M10 8h4M10 12h4'
          stroke='currentColor'
          strokeWidth='1.3'
          strokeLinecap='round'
        />
      </svg>
      {t('autoLayout')}
    </button>
  )
}
