import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {ImageIcon, LucideProps} from 'lucide-react'

export const RoadMediaTask = {
  type: RoadMapBlockType.INFO_MEDIA,
  label: 'Медиа',
  headerColor: '',
  icon: (props: LucideProps) => <ImageIcon {...props} />,
  inputs: [
    {
      name: '',
      type: RoadMapParamType.HIDE,
      helpText: 'please, write',
      required: true,
      hideHandle: false
    }
  ],
  outputs: [
    {
      name: '',
      type: RoadMapParamType.STRING,
      helpText: 'please, write',
      required: true,
      hideHandle: false
    }
  ]
} satisfies RoadMapTask
