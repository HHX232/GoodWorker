// OtherBlocks/ActiveTestBlock/BlockEditorSwitch.tsx
'use client'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useActions} from '@/features/hooks/store/useActions'
import ChooseOptionEditor from '@/widgets/Tasks/BlockEditor/ChooseOptionEditor/ChooseOptionEditor'
import FreeAnswerEditor from '@/widgets/Tasks/BlockEditor/FreeAnswerEditor/FreeAnswerEditor'
import {FillTextEditor} from '@/widgets/Tasks/BlockEditor/FillTextEditor/FillTextEditor'
import SequenceEditor from '@/widgets/Tasks/BlockEditor/SequenceEditor/SequenceEditor'
import MatchPairsEditor from '@/widgets/Tasks/BlockEditor/MatchPairsEditor/MatchPairsEditor'
import {HighlightTextEditor} from '@/widgets/Tasks/BlockEditor/HighlightTextEditor/HighlightTextEditor'
import {WordScrambleEditor} from '@/widgets/Tasks/BlockEditor/WordScrambleEditor/WordScrambleEditor'
import {DialogueEditor} from '@/widgets/Tasks/BlockEditor/DialogueEditor/DialogueEditor'
import {useEffect} from 'react'
import {useDispatch} from 'react-redux'

// Патч: подменяем updateBlockPayload → updateActiveBlockPayload
// Редакторы диспатчат 'constructor/updateBlockPayload'
// Мы перехватываем через middleware или... проще: просто слушаем нужный slice

// Самый чистый способ без middleware:
// передаём фиктивный blockId который совпадает с id в activeTest slice,
// и добавляем в редюсер activeTest обработчик экшена constructor/updateBlockPayload

export function BlockEditorSwitch({block}: {block: TestBlock}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = block.payload as any

  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION:
      return <ChooseOptionEditor blockId={block.id} payload={p} />
    case TaskBlockType.FREE_ANSWER:
      return <FreeAnswerEditor blockId={block.id} payload={p} />
    case TaskBlockType.FILL_TEXT:
      return <FillTextEditor blockId={block.id} payload={p} />
    case TaskBlockType.SEQUENCE:
      return <SequenceEditor blockId={block.id} payload={p} />
    case TaskBlockType.MATCH_PAIRS:
      return <MatchPairsEditor blockId={block.id} payload={p} />
    case TaskBlockType.HIGHLIGHT_TEXT:
      return <HighlightTextEditor blockId={block.id} payload={p} />
    case TaskBlockType.WORD_SCRAMBLE:
      return <WordScrambleEditor blockId={block.id} payload={p} />
    case TaskBlockType.DIALOGUE:
      return <DialogueEditor blockId={block.id} payload={p} />
    default:
      return null
  }
}
