import { InfoAudioPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import { Mic2Icon } from 'lucide-react'
import { TaskBlockMeta } from '../TaskRegistry'
 
export const InfoAudioTask: TaskBlockMeta & { type: TaskBlockType.INFO_AUDIO } = {
  type: TaskBlockType.INFO_AUDIO,
  label: 'Аудио сообщение',
  description: 'Аудиофайл для прослушивания учеником',
  icon: <Mic2Icon className="stroke-rose-400" />,
  credits: 0,
  defaultPayload: { url: null, filename: null, waveform: null } satisfies InfoAudioPayload,
  availableFor: ['lang'],
}