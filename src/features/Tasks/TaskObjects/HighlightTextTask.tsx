import { HighlightTextPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { HighlighterIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'
 
export const HighlightTextTask: TaskBlockMeta & { type: TaskBlockType.HIGHLIGHT_TEXT } = {
  type: TaskBlockType.HIGHLIGHT_TEXT,
  label: 'Выдели слова',
  description: 'Нажми на правильные слова в тексте',
  icon: <HighlighterIcon className="stroke-yellow-400" />,
  credits: 0,
  defaultPayload: { instruction: null, tokens: null } satisfies HighlightTextPayload,
  availableFor: ['lang'],
}
 