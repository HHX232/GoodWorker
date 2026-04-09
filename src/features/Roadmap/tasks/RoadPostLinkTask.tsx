import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {ClipboardList, LucideProps} from 'lucide-react'

export const RoadPostLinkTask = {
  type: RoadMapBlockType.TEST_LINK,
  label: 'linkTestLabel',
  headerColor: '',
  icon: (props: LucideProps) => <ClipboardList {...props} />,
  inputs: [
    {
      name: 'linkTestLabel',
      type: RoadMapParamType.SELECT_MY_TEST,
      helpText: 'helpClickText',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
