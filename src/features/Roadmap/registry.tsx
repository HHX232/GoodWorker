
import { RoadMapBlockType } from '@/shared/types/RoadMap/RoadMap.types'

type Registry = {
  [K in RoadMapBlockType]: {type: K}
}

const TaskBlockRegistry: Registry = {
  [RoadMapBlockType.TEST_LINK]: {type: RoadMapBlockType.TEST_LINK},
  [RoadMapBlockType.POST_LINK]: {type: RoadMapBlockType.POST_LINK},
  [RoadMapBlockType.GROUP_POSTS_LINK]: {type: RoadMapBlockType.GROUP_POSTS_LINK},
  [RoadMapBlockType.ACTIVE_TEST_LINK]: {type: RoadMapBlockType.ACTIVE_TEST_LINK},
  [RoadMapBlockType.TEACHER_SERVICE_LINK]: {type: RoadMapBlockType.TEACHER_SERVICE_LINK},
  [RoadMapBlockType.DOWNLOAD_FILE_LINK]: {type: RoadMapBlockType.DOWNLOAD_FILE_LINK},
  [RoadMapBlockType.INFO_TEXT]: {type: RoadMapBlockType.INFO_TEXT},
  [RoadMapBlockType.INFO_MEDIA]: {type: RoadMapBlockType.INFO_MEDIA},
  [RoadMapBlockType.INFO_AUDIO]: {type: RoadMapBlockType.INFO_AUDIO}
}

export default TaskBlockRegistry
