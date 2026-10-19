import { RoadMapBlockType, RoadMapTask } from '@/shared/types/RoadMap/RoadMap.types'
import { RoadActiveTestTask } from './tasks/RoadActiveTestTask'
import { RoadAudioTask } from './tasks/RoadAudioTask'
import { RoadDividerTask } from './tasks/RoadDividerTask'
import { RoadEntryPointTask } from './tasks/RoadEntryPointTask'
import { RoadFileTask } from './tasks/RoadFileTask'
import { RoadHelpTextTask } from './tasks/RoadHelpTextTask'
import { RoadMediaTask } from './tasks/RoadMediaTask'
import { RoadPostLinkTask } from './tasks/RoadPostLinkTask'
import { RoadPostsLinkTask } from './tasks/RoadPostsLinkTask'
import { ActiveCommentTask } from './tasks/ActiveCommentTask'
import { RoadChessTask } from './tasks/RoadChessTask'

type Registry = {
  [K in RoadMapBlockType]: RoadMapTask & {type: K}
}

const RoadMapBlockRegistry: Registry = {
  [RoadMapBlockType.TEST_LINK]: RoadPostLinkTask,
  [RoadMapBlockType.INFO_TEXT]: RoadHelpTextTask,
  [RoadMapBlockType.DIVIDER]: RoadDividerTask,
  [RoadMapBlockType.INFO_AUDIO]: RoadAudioTask,
  [RoadMapBlockType.INFO_MEDIA]: RoadMediaTask,
  [RoadMapBlockType.ENTRY_POINT]: RoadEntryPointTask,
  [RoadMapBlockType.POST_LINK]: RoadPostsLinkTask,
  [RoadMapBlockType.DOWNLOAD_FILE_LINK]: RoadFileTask,
  [RoadMapBlockType.ACTIVE_TEST]: RoadActiveTestTask,
  [RoadMapBlockType.ACTIVE_COMMENT]: ActiveCommentTask,
  [RoadMapBlockType.CHESS]: RoadChessTask,

}

/** Root-level i18n key of a task label: bare keys are in `roadMap`, dotted ones are already full. */
export const roadMapLabel = (label: string) => (label.includes('.') ? label : `roadMap.${label}`)

export default RoadMapBlockRegistry
