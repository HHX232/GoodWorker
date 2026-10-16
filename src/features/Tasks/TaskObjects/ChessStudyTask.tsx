import {START_FEN} from '@/shared/lib/chess/puzzle'
import {ChessStudyPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {ChessRookIcon} from 'lucide-react'
import {TestUserBlockMeta} from '../TaskRegistry'

export const ChessStudyTask: TestUserBlockMeta & {type: TaskBlockType.CHESS_STUDY} = {
  type: TaskBlockType.CHESS_STUDY,
  label: 'Шахматный разбор',
  description: 'Позиция и ходы с комментариями — ученик листает разбор',
  icon: <ChessRookIcon className='stroke-amber-700' />,
  credits: 0,
  defaultPayload: {fen: START_FEN, moves: []} satisfies ChessStudyPayload,
  availableFor: ['all']
}
