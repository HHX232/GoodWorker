import {FreeAnswerPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {MessageSquareIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const FreeAnswerTask: TestUserBlockMeta & {type: TaskBlockType.FREE_ANSWER} = {
  type: TaskBlockType.FREE_ANSWER,
  label: 'Свободный ответ',
  description: 'Ученик пишет ответ в свободной форме',
  icon: <MessageSquareIcon className='stroke-orange-400' />,
  credits: 0,
  defaultPayload: {
    question: '',
    referenceAnswer: ''
  } satisfies FreeAnswerPayload,
  availableFor: ['all']
}
