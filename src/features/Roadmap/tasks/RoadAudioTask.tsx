import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {Headphones, LucideProps} from 'lucide-react'

export const RoadAudioTask = {
  type: RoadMapBlockType.INFO_AUDIO,
  label: 'audioLabel',
  headerColor: '',
  icon: (props: LucideProps) => <Headphones {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
