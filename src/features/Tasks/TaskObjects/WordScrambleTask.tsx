import { WordScramblePayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { ShuffleIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'
 
export const WordScrambleTask: TaskBlockMeta & { type: TaskBlockType.WORD_SCRAMBLE } = {
  type: TaskBlockType.WORD_SCRAMBLE,
  label: 'Собери слово',
  description: 'Расставь буквы или слова в правильном порядке',
  icon: <ShuffleIcon className="stroke-orange-400" />,
  credits: 0,
  defaultPayload: { mode: 'letters', source: null, hint: null } satisfies WordScramblePayload,
  availableFor: ['lang'],
}
 
