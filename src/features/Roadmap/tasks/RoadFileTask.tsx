import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {LucideProps, PaperclipIcon} from 'lucide-react'

export const RoadFileTask = {
  type: RoadMapBlockType.DOWNLOAD_FILE_LINK,
  label: 'FilesLabel',
  headerColor: '',
  icon: (props: LucideProps) => <PaperclipIcon {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
