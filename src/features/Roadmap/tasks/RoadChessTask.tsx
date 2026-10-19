import {RoadMapBlockType, RoadMapParamType, RoadMapTask} from '@/shared/types/RoadMap/RoadMap.types'
import {ChessKnight, LucideProps} from 'lucide-react'

export const RoadChessTask = {
  type: RoadMapBlockType.CHESS,
  // full key: chess strings live in messages/chess/course, not in the roadMap namespace (see roadMapLabel)
  label: 'chess.course.nodeLabel',
  headerColor: '',
  icon: (props: LucideProps) => <ChessKnight {...props} />,
  inputs: [{name: '', type: RoadMapParamType.HIDE}],
  outputs: [{name: '', type: RoadMapParamType.HIDE}]
} satisfies RoadMapTask
