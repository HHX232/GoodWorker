import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LucideProps, TextCursorIcon} from 'lucide-react'

export const RoadHelpTextTask = {
  type: RoadMapBlockType.INFO_TEXT,
  label: 'infoTextLabel',
  headerColor: '',
  icon: (props: LucideProps) => <TextCursorIcon {...props} />,
  inputs: [
    {
      name: RoadMapBlockType.INFO_TEXT,
      type: RoadMapParamType.STRING,
      helpText: 'infoTextHelpText',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [{name: '', type: RoadMapParamType.STRING}]
} satisfies RoadMapTask
