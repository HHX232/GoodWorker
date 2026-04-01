import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {ClipboardList, LucideProps} from 'lucide-react'

export const RoadPostLinkTask = {
  type: RoadMapBlockType.TEST_LINK,
  label: 'Link to test',
  headerColor: '',
  icon: (props: LucideProps) => <ClipboardList {...props} />,
  inputs: [
    {
      name: 'Link to test',
      type: RoadMapParamType.SELECT_MY_TEST,
      helpText: 'please, click',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
