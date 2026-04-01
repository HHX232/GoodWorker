import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LucideProps, TextCursorIcon} from 'lucide-react'

export const RoadHelpTextTask = {
  type: RoadMapBlockType.INFO_TEXT,
  label: 'Write help text',
  headerColor: '',
  icon: (props: LucideProps) => <TextCursorIcon {...props} />,
  inputs: [
    {
      name: '',
      type: RoadMapParamType.STRING,
      helpText: 'please, write',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
