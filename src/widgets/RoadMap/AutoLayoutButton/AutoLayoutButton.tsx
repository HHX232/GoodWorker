import dagre from '@dagrejs/dagre'
import {useReactFlow} from '@xyflow/react'

export function AutoLayoutButton() {
  const {getNodes, getEdges, setNodes, fitView} = useReactFlow()

  const applyLayout = () => {
    const nodes = getNodes()
    const edges = getEdges()

    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))

    graph.setGraph({
      rankdir: 'LR', // слева направо, 'TB' — сверху вниз
      nodesep: 150, // расстояние между нодами по вертикали
      ranksep: 150 // расстояние между колонками,
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

  return <button onClick={applyLayout}>Авто-расстановка</button>
}
