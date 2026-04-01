/* eslint-disable @typescript-eslint/no-explicit-any */
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'

export interface BlockValidationTestBlockError {
  blockId: string
  message: string
}

function validateTestBlock(block: TestBlock): string | null {
  const p = block.payload as any

  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION: {
      if (!p.options?.length || p.options.length < 2) return 'Добавьте минимум 2 варианта'
      const hasCorrect = Array.isArray(p.correctId) ? p.correctId.length > 0 : !!p.correctId
      if (!hasCorrect) return 'Отметьте правильный ответ'
      return null
    }

    case TaskBlockType.SEQUENCE: {
      if (!p.items?.length || p.items.length < 2) return 'Добавьте минимум 2 элемента'
      const hasEmpty = p.items.some((i: any) => !i.text?.trim())
      if (hasEmpty) return 'Заполните все элементы последовательности'
      return null
    }

    case TaskBlockType.MATCH_PAIRS: {
      if (!p.pairs?.length || p.pairs.length < 2) return 'Добавьте минимум 2 пары'
      const hasEmpty = p.pairs.some((pair: any) => !pair.left?.trim() || !pair.right?.trim())
      if (hasEmpty) return 'Заполните все пары'
      return null
    }

    case TaskBlockType.FREE_ANSWER: {
      if (!p.referenceAnswer?.trim()) return 'Укажите эталонный ответ'
      return null
    }

    case TaskBlockType.HIGHLIGHT_TEXT: {
      if (!p.tokens?.length) return 'Добавьте текст и разбейте на слова'
      const hasCorrect = p.tokens.some((t: any) => t.isCorrect)
      if (!hasCorrect) return 'Отметьте хотя бы одно правильное слово'
      return null
    }

    case TaskBlockType.WORD_SCRAMBLE: {
      if (!p.source?.trim()) return 'Введите слово или предложение'
      return null
    }

    case TaskBlockType.DIALOGUE: {
      if (!p.lines?.length || p.lines.length < 2) return 'Добавьте минимум 2 реплики'
      const hasEmpty = p.lines.some((l: any) => !l.text?.trim())
      if (hasEmpty) return 'Заполните все реплики'
      return null
    }

    case TaskBlockType.FILL_TEXT: {
      if (!p.content) return 'Добавьте текст с пропусками'
      const hasGap = JSON.stringify(p.content).includes('inputGap') || JSON.stringify(p.content).includes('selectGap')
      if (!hasGap) return 'Добавьте хотя бы один пропуск'
      return null
    }

    case TaskBlockType.INFO_TEXT: {
      const text = JSON.stringify(p.content ?? '')
      if (text.length < 10) return 'Добавьте текст'
      return null
    }

    case TaskBlockType.INFO_MEDIA: {
      if (!p.url) return 'Загрузите изображение или видео'
      return null
    }

    case TaskBlockType.INFO_AUDIO: {
      if (!p.url) return 'Загрузите аудиофайл'
      return null
    }

    default:
      return null
  }
}

export function validateTestBlocks(blocks: TestBlock[]): BlockValidationTestBlockError[] {
  if (blocks.length === 0) return []
  return blocks
    .map((block) => {
      const message = validateTestBlock(block)
      return message ? {blockId: block.id, message} : null
    })
    .filter(Boolean) as BlockValidationTestBlockError[]
}
