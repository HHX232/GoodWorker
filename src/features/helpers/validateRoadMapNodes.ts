/* eslint-disable @typescript-eslint/no-explicit-any */
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {RoadMapBlockType, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {Node} from '@xyflow/react'

export interface RoadMapNodeError {
  nodeId: string
  message: string
}

type Validator = (data: RoadNodeData) => string | null

const validators: Partial<Record<RoadMapBlockType, Validator>> = {
  [RoadMapBlockType.ENTRY_POINT]: (data) => {
    if (!data.roadTitle?.trim()) return 'Укажите название road-map'
    if (!data.roadCategory?.trim()) return 'Укажите категорию'
    return null
  },

  [RoadMapBlockType.ACTIVE_TEST]: (data) => {
    const tests = (data.activeTests ?? []) as TestBlock[]
    if (tests.length === 0) return 'Добавьте хотя бы один вопрос'
    for (const block of tests) {
      const err = validateTestBlock(block)
      if (err) return err
    }
    return null
  },

  [RoadMapBlockType.POST_LINK]: (data) => {
    const ids = (data.selectedPostIds ?? []) as string[]
    if (ids.length === 0) return 'Выберите хотя бы один пост'
    return null
  },

  [RoadMapBlockType.INFO_TEXT]: (data) => {
    const content = (data.inputs as any)?.[RoadMapBlockType.INFO_TEXT] ?? data.content
    if (!content?.trim()) return 'Добавьте текст'
    return null
  },

  [RoadMapBlockType.INFO_MEDIA]: (data) => {
    const items = (data.mediaItems ?? []) as {url: string}[]
    if (items.length === 0 || !items[0]?.url?.trim()) return 'Добавьте медиафайл'
    return null
  },

  [RoadMapBlockType.INFO_AUDIO]: (data) => {
    if (!(data.audioUrl as string)?.trim()) return 'Добавьте аудиофайл'
    return null
  },

  [RoadMapBlockType.DOWNLOAD_FILE_LINK]: (data) => {
    const files = (data.uploadedFiles ?? []) as {url: string}[]
    if (files.length === 0) return 'Добавьте файл для скачивания'
    return null
  },

  [RoadMapBlockType.DIVIDER]: () => null
}

function validateTestBlock(block: TestBlock): string | null {
  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION: {
      const p = block.payload as {question: string; options: {id: string; text: string}[]; correctId: string | string[]}
      if (!p.question?.trim()) return 'Вопрос не заполнен'
      if (p.options.length < 2) return 'Добавьте минимум 2 варианта ответа'
      if (p.options.some((o) => !o.text?.trim())) return 'Заполните все варианты ответа'
      const hasCorrect = Array.isArray(p.correctId) ? p.correctId.length > 0 : !!p.correctId
      if (!hasCorrect) return 'Отметьте правильный ответ'
      return null
    }
    case TaskBlockType.FREE_ANSWER: {
      const p = block.payload as {question: string; referenceAnswer?: string}
      if (!p.question?.trim()) return 'Вопрос не заполнен'
      return null
    }
    case TaskBlockType.SEQUENCE: {
      const p = block.payload as {items: {id: string; text: string}[]}
      if (p.items.length < 2) return 'Добавьте минимум 2 элемента'
      if (p.items.some((i) => !i.text?.trim())) return 'Заполните все элементы последовательности'
      return null
    }
    case TaskBlockType.MATCH_PAIRS: {
      const p = block.payload as {pairs: {id: string; left: string; right: string}[]}
      if (p.pairs.length < 2) return 'Добавьте минимум 2 пары'
      if (p.pairs.some((p) => !p.left?.trim() || !p.right?.trim())) return 'Заполните все пары'
      return null
    }
    case TaskBlockType.HIGHLIGHT_TEXT: {
      const p = block.payload as {tokens: {isCorrect: boolean}[] | null}
      if (!p.tokens || p.tokens.length === 0) return 'Добавьте текст для выделения'
      if (!p.tokens.some((t) => t.isCorrect)) return 'Отметьте хотя бы одно правильное слово'
      return null
    }
    case TaskBlockType.WORD_SCRAMBLE: {
      const p = block.payload as {source: string | null}
      if (!p.source?.trim()) return 'Введите слово или предложение'
      return null
    }
    case TaskBlockType.FILL_TEXT: {
      const p = block.payload as {content: object | null}
      if (!p.content) return 'Добавьте текст с пропусками'
      return null
    }
    case TaskBlockType.DIALOGUE: {
      const p = block.payload as {lines: {text: string}[]}
      if (p.lines.length < 2) return 'Добавьте минимум 2 реплики'
      if (p.lines.some((l) => !l.text?.trim())) return 'Заполните все реплики'
      return null
    }
    default:
      return null
  }
}

export function validateRoadMapNodes(nodes: Node<RoadNodeData>[]): RoadMapNodeError[] {
  const errors: RoadMapNodeError[] = []
  // console.log(
  //   'NODES DATA:',
  //   JSON.stringify(
  //     nodes.map((n) => ({id: n.id, data: n.data})),
  //     null,
  //     2
  //   )
  // )

  for (const node of nodes) {
    const type = node.data.type
    const validator = validators[type]
    if (!validator) continue

    const message = validator(node.data)
    if (message) errors.push({nodeId: node.id, message})
  }

  return errors
}
