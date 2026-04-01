import {MatchPairsPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'

import {nanoid} from '@reduxjs/toolkit'
import {ArrowLeftRightIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const MatchPairsTask: TestUserBlockMeta & {type: TaskBlockType.MATCH_PAIRS} = {
  type: TaskBlockType.MATCH_PAIRS,
  label: 'Сопоставь пары',
  description: 'Соедини элементы левого столбца с правым',
  icon: <ArrowLeftRightIcon className='stroke-purple-400' />,
  credits: 0,
  defaultPayload: {
    pairs: [
      {id: nanoid(), left: '', right: ''},
      {id: nanoid(), left: '', right: ''}
    ]
  } satisfies MatchPairsPayload,
  availableFor: ['all']
}
