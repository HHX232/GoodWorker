import {RoadMapBlockType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {RoadAudioTask} from './tasks/RoadAudioTask'
import {RoadDividerTask} from './tasks/RoadDividerTask'
import {RoadEntryPointTask} from './tasks/RoadEntryPointTask'
import {RoadFileTask} from './tasks/RoadFileTask'
import {RoadHelpTextTask} from './tasks/RoadHelpTextTask'
import {RoadMediaTask} from './tasks/RoadMediaTask'
import {RoadPostLinkTask} from './tasks/RoadPostLinkTask'
import {RoadPostsLinkTask} from './tasks/RoadPostsLinkTask'
import {RoadActiveTestTask} from './tasks/RoadActiveTestTask'

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
  [RoadMapBlockType.ACTIVE_TEST]: RoadActiveTestTask

  // [RoadMapBlockType.POST_LINK]: {type: RoadMapBlockType.POST_LINK},
  // [RoadMapBlockType.GROUP_POSTS_LINK]: {type: RoadMapBlockType.GROUP_POSTS_LINK},
  // [RoadMapBlockType.ACTIVE_TEST_LINK]: {type: RoadMapBlockType.ACTIVE_TEST_LINK},
  // [RoadMapBlockType.TEACHER_SERVICE_LINK]: {type: RoadMapBlockType.TEACHER_SERVICE_LINK},
  // [RoadMapBlockType.DOWNLOAD_FILE_LINK]: {type: RoadMapBlockType.DOWNLOAD_FILE_LINK},
  // [RoadMapBlockType.INFO_TEXT]: {type: RoadMapBlockType.INFO_TEXT},
  // [RoadMapBlockType.INFO_MEDIA]: {type: RoadMapBlockType.INFO_MEDIA},
  // [RoadMapBlockType.INFO_AUDIO]: {type: RoadMapBlockType.INFO_AUDIO}
}

export default RoadMapBlockRegistry
