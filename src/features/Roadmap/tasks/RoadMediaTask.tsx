import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {ImageIcon, LucideProps} from 'lucide-react'

export const RoadMediaTask = {
  type: RoadMapBlockType.INFO_MEDIA,
  label: 'mediaInfoLabel',
  headerColor: '',
  icon: (props: LucideProps) => <ImageIcon {...props} />,
  inputs: [
    {
      name: '',
      type: RoadMapParamType.HIDE,
      helpText: 'infoTextHelpText',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [
    {
      name: '',
      type: RoadMapParamType.STRING,
      helpText: 'infoTextHelpText',
      required: true,
      hideHandle: false
    }
  ]
} satisfies RoadMapTask
