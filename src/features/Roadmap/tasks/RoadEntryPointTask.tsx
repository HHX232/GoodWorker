import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {MapIcon, LucideProps} from 'lucide-react'

export const RoadEntryPointTask = {
  type: RoadMapBlockType.ENTRY_POINT,
  label: 'entryLabel',
  headerColor: '#141416',
  isEntryPoint: true,
  icon: (props: LucideProps) => <MapIcon {...props} />,
  inputs: [],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
