import { SequencePayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { TaskBlockMeta } from '../TaskRegistry'
import { ListOrderedIcon } from 'lucide-react'

export const SequenceTask: TaskBlockMeta & { type: TaskBlockType.SEQUENCE } = {
  type: TaskBlockType.SEQUENCE,
  label: 'Последовательность',
  description: 'Расставь пункты в правильном порядке',
  icon: <ListOrderedIcon className="stroke-green-400" />,
  credits: 0,
  defaultPayload: { items: [] } satisfies SequencePayload,
  availableFor: ['all'],
}