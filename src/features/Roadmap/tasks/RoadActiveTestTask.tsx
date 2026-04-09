import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LucideProps, NotebookPen} from 'lucide-react'

export const RoadActiveTestTask = {
  type: RoadMapBlockType.ACTIVE_TEST,
  label: 'testLabel',
  headerColor: '',
  icon: (props: LucideProps) => <NotebookPen {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
