import {PostBlockMeta, PostBlockType} from '@/shared/types/Post/Post.type'
import {ClipboardCheckIcon, FileTextIcon, ImageIcon, LinkIcon, MapIcon, MicIcon, PaperclipIcon, TypeIcon} from 'lucide-react'

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
    defaultPayload: {tests: []}
  },
  [PostBlockType.MINI_TEST]: {
    type: PostBlockType.MINI_TEST,
    label: 'Мини-тест',
    description: 'Встроенный тест с результатом',
    icon: <ClipboardCheckIcon className='stroke-rose-400' />,
    defaultPayload: {title: '', blocks: []}
  },
  [PostBlockType.POST_LINK]: {
    type: PostBlockType.POST_LINK,
    label: 'Ссылка на пост',
    description: 'Студент читает пост и отмечает как выполненный',
    icon: <FileTextIcon className='stroke-sky-400' />,
    defaultPayload: {postId: '', postTitle: ''}
  },
  [PostBlockType.ROAD_MAP_LINK]: {
    type: PostBlockType.ROAD_MAP_LINK,
    label: 'Курс',
    description: 'Прогресс студента по курсу',
    icon: <MapIcon className='stroke-emerald-500' />,
    defaultPayload: {roadmapId: '', roadmapTitle: ''}
  },
  [PostBlockType.FILE_LIST]: {
    type: PostBlockType.FILE_LIST,
    label: 'Файлы',
    description: 'Список прикреплённых файлов',
    icon: <PaperclipIcon className='stroke-orange-400' />,
    defaultPayload: {files: []}
  }
}
