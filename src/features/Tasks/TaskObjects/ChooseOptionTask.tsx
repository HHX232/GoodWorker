import { ChooseOptionPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { ListChecksIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'

export const ChooseOptionTask: TaskBlockMeta & { type: TaskBlockType.CHOOSE_OPTION } = {
  type: TaskBlockType.CHOOSE_OPTION,
  label: 'Выбери вариант',
  description: 'Один правильный ответ из нескольких вариантов',
  icon: <ListChecksIcon className="stroke-yellow-400" />,
  credits: 0,
  defaultPayload: {
    question: '',
    options: [],
    correctId: '',
  } satisfies ChooseOptionPayload,
  availableFor: ['all'],
}