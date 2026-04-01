// features/test-block-editor/model/TaskObjects/DialogueTask.tsx
import {DialoguePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {MessageSquareIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const DialogueTask: TestUserBlockMeta & {type: TaskBlockType.DIALOGUE} = {
  type: TaskBlockType.DIALOGUE,
  label: 'Диалог',
  description: 'Расставь реплики диалога в правильном порядке',
  icon: <MessageSquareIcon className='stroke-sky-500' />,
  credits: 0,
  defaultPayload: {
    instruction: null,
    speakers: {a: '', b: ''},
    lines: []
  } satisfies DialoguePayload,
  availableFor: ['lang']
}
