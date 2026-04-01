import {SequencePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {nanoid} from '@reduxjs/toolkit'
import {ListOrderedIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const SequenceTask: TestUserBlockMeta & {type: TaskBlockType.SEQUENCE} = {
  type: TaskBlockType.SEQUENCE,
  label: 'Последовательность',
  description: 'Расставь пункты в правильном порядке',
  icon: <ListOrderedIcon className='stroke-green-400' />,
  credits: 0,
  defaultPayload: {items: [{id: nanoid(), text: ''}]} satisfies SequencePayload,
  availableFor: ['all']
}
