import { InfoMediaPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { ImageIcon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'
 
export const InfoMediaTask: TaskBlockMeta & { type: TaskBlockType.INFO_MEDIA } = {
  type: TaskBlockType.INFO_MEDIA,
  label: 'Фото / Видео',
  description: 'Изображение или видео как иллюстрация к материалу',
  icon: <ImageIcon className="stroke-violet-500" />,
  credits: 0,
  defaultPayload: { kind: null, url: null, caption: null } satisfies InfoMediaPayload,
  availableFor: ['lang'],
}
 