import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LayoutGridIcon, LucideProps} from 'lucide-react'

export const RoadPostsLinkTask = {
  type: RoadMapBlockType.POST_LINK,
  label: 'postslabel',
  headerColor: '',
  icon: (props: LucideProps) => <LayoutGridIcon {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
