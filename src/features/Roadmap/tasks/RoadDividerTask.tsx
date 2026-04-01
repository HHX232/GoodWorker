import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LucideProps, SeparatorVertical} from 'lucide-react'

export const RoadDividerTask = {
  type: RoadMapBlockType.DIVIDER,
  label: 'Раздел',
  headerColor: '',
  icon: (props: LucideProps) => <SeparatorVertical {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
