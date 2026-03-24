import { MatchPairsPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'

import { ArrowLeftRightIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'

export const MatchPairsTask: TaskBlockMeta & { type: TaskBlockType.MATCH_PAIRS } = {
  type: TaskBlockType.MATCH_PAIRS,
  label: 'Сопоставь пары',
  description: 'Соедини элементы левого столбца с правым',
  icon: <ArrowLeftRightIcon className="stroke-purple-400" />,
  credits: 0,
  defaultPayload: {
    pairs: [],
  } satisfies MatchPairsPayload,
  availableFor: ['all'],
}