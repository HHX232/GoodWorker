import {PostBlockMeta, PostBlockType} from '@/shared/types/Post/Post.type'
import {ImageIcon, LinkIcon, MicIcon, TypeIcon} from 'lucide-react'

type PostBlockRegistry = {[K in PostBlockType]: PostBlockMeta & {type: K}}

export const PostBlockRegistry: PostBlockRegistry = {
  [PostBlockType.TEXT]: {
    type: PostBlockType.TEXT,
    label: 'Текст',
    description: 'Абзац, заголовки, форматирование',
    icon: <TypeIcon className='stroke-blue-400' />,
    defaultPayload: {content: null}
  },
  [PostBlockType.MEDIA]: {
    type: PostBlockType.MEDIA,
    label: 'Медиа',
    description: 'Фото или видео',
    icon: <ImageIcon className='stroke-emerald-400' />,
    defaultPayload: {kind: null, url: null, caption: null}
  },
  [PostBlockType.AUDIO]: {
    type: PostBlockType.AUDIO,
    label: 'Аудио',
    description: 'Аудиозапись или подкаст',
    icon: <MicIcon className='stroke-amber-400' />,
    defaultPayload: {url: null, filename: null, waveform: null}
  },
  [PostBlockType.TEST_LINK]: {
    type: PostBlockType.TEST_LINK,
    label: 'Тест',
    description: 'Ссылка на тест',
    icon: <LinkIcon className='stroke-violet-400' />,
    defaultPayload: {testId: null, title: null}
  }
}
