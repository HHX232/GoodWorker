import { InfoTextPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { AlignLeftIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'
 
export const InfoTextTask: TaskBlockMeta & { type: TaskBlockType.INFO_TEXT } = {
  type: TaskBlockType.INFO_TEXT,
  label: 'Текстовый блок',
  description: 'Форматированный текст для объяснения материала',
  icon: <AlignLeftIcon className="stroke-emerald-500" />,
  credits: 0,
  defaultPayload: { content: null } satisfies InfoTextPayload,
  availableFor: ['lang'],
}
 
 