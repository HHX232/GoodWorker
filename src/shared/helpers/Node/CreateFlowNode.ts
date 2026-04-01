import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {RoadMapBlockType, RoadMapParamType, RoadNode} from '@/shared/types/RoadMap/RoadMap.types'

export function createRoadNode(type: RoadMapBlockType, position: {x: number; y: number}, headerColor = ''): RoadNode {
  const inputsDef = RoadMapBlockRegistry[type].inputs
  const inputs = Object.fromEntries(inputsDef.map((el) => [el.name, el.value ?? '']))
  console.log('created inputs', inputs)
  return {
    id: crypto.randomUUID(),
    type: 'FlowScrapeNode',
    position: position ?? {x: 0, y: 0},
    data: {
      type,
      inputs: inputs,
      headerColor: headerColor ? headerColor : '',
      outputs: type === RoadMapBlockType.DIVIDER ? [{name: 'Выход 1', type: RoadMapParamType.STRING}] : undefined
    }
  }
}
