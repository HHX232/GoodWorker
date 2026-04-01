import {FillTextPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {PencilIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const FillTextTask: TestUserBlockMeta & {type: TaskBlockType.FILL_TEXT} = {
  type: TaskBlockType.FILL_TEXT,
  label: 'Вставь пропуск',
  description: 'Текст с пропущенными буквами или словами',
  icon: <PencilIcon className='stroke-blue-400' />,
  credits: 0,
  defaultPayload: {content: null} satisfies FillTextPayload,
  availableFor: ['lang']
}
