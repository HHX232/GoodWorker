import { RoadMapBlockType, RoadMapParamType, RoadMapTask } from '@/shared/types/RoadMap/RoadMap.types'
import { Album, LucideProps } from 'lucide-react'

export const ActiveCommentTask = {
  type: RoadMapBlockType.ACTIVE_COMMENT,
  label: 'ForComments',
  headerColor: '',
  icon: (props: LucideProps) => <Album {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
