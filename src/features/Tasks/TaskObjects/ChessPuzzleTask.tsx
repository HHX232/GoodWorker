import {START_FEN} from '@/shared/lib/chess/puzzle'
import {ChessPuzzlePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {ChessKnightIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

// Labels are plain Russian strings like every other registry entry (the palette doesn't go through next-intl).
export const ChessPuzzleTask: TestUserBlockMeta & {type: TaskBlockType.CHESS_PUZZLE} = {
  type: TaskBlockType.CHESS_PUZZLE,
  label: 'Шахматная задача',
  description: 'Позиция на доске — ученик находит решение ходами',
  icon: <ChessKnightIcon className='stroke-amber-700' />,
  credits: 0,
  defaultPayload: {fen: START_FEN, solution: [], prompt: ''} satisfies ChessPuzzlePayload,
  availableFor: ['all']
}
