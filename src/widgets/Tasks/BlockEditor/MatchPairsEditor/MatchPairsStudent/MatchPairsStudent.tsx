import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {MatchPairsPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useState} from 'react'
import {MatchConnector} from '../MatchConnector/MatchConnector'

export function MatchPairsStudent({
  payload,
  onChange
}: {
  payload: MatchPairsPayload
  onChange: (a: StudentAnswer) => void
}) {
  const [matches, setMatches] = useState<Map<string, string>>(new Map())

  const [rightItems] = useState(() =>
    [...payload.pairs].map((p) => ({id: p.id, content: p.right})).sort(() => Math.random() - 0.5)
  )

  const leftItems = payload.pairs.map((p) => ({id: p.id, content: p.left}))

  const handleMatchesChange = (next: Map<string, string>) => {
    setMatches(next)
    onChange({type: TaskBlockType.MATCH_PAIRS, value: next})
  }

  return (
    <MatchConnector
      gradientId={`student-${payload.pairs[0]?.id ?? 'mp'}`}
      leftItems={leftItems}
      rightItems={rightItems}
      matches={matches}
      onMatchesChange={handleMatchesChange}
    />
  )
}
