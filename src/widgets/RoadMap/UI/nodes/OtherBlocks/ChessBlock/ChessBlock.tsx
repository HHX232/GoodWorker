'use client'

import {START_FEN} from '@/shared/lib/chess/puzzle'
import {ChessNodeData, RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useRoadmapProgress} from '@/shared/ui/RoadMap/context/RoadmapProgressContext'
import {ChessPuzzleEditor, ChessStudyEditor} from '@/widgets/Tasks/BlockEditor/ChessEditor/ChessEditor'
import {ChessPuzzleStudent, ChessStudyStudent} from '@/widgets/Tasks/BlockEditor/ChessEditor/ChessStudent'
import {useReactFlow, useStore} from '@xyflow/react'
import {useTranslations} from 'next-intl'
import {useRef} from 'react'
import styles from './ChessBlock.module.scss'

const DEFAULT: ChessNodeData = {mode: 'puzzle', fen: START_FEN, solution: [], moves: []}

export default function ChessBlock({nodeId, isView}: {nodeId: string; isView: boolean}) {
  const t = useTranslations('chess.course')
  const {updateNodeData} = useReactFlow()
  const {markCompleted, completedNodeIds} = useRoadmapProgress()
  const chess = useStore((s) => (s.nodeLookup.get(nodeId)?.data as RoadNodeData | undefined)?.chess) ?? DEFAULT
  const marked = useRef(false)

  const set = (patch: Partial<ChessNodeData>) => updateNodeData(nodeId, {chess: {...chess, ...patch}})
  const puzzle = {fen: chess.fen, solution: chess.solution ?? [], prompt: chess.prompt}
  const study = {fen: chess.fen, moves: chess.moves ?? []}

  if (isView) {
    return (
      <div className={`${styles.box} nodrag nopan nowheel`}>
        {chess.mode === 'study' ? (
          <ChessStudyStudent payload={study} />
        ) : (
          <ChessPuzzleStudent
            payload={puzzle}
            onChange={(a) => {
              // solved (even after a mistake) = node passed; score stays the test's business
              if (!a.done || marked.current || completedNodeIds.has(nodeId)) return
              marked.current = true
              markCompleted([nodeId])
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.box} nodrag nopan nowheel`}>
      <div className={styles.segment} role='radiogroup' aria-label={t('nodeMode')}>
        {(['puzzle', 'study'] as const).map((m) => (
          <button
            key={m}
            type='button'
            role='radio'
            aria-checked={chess.mode === m}
            className={`${styles.segment_btn} ${chess.mode === m ? styles.segment_active : ''}`}
            onClick={() => set({mode: m})}
          >
            {t(m === 'puzzle' ? 'nodeModePuzzle' : 'nodeModeStudy')}
          </button>
        ))}
      </div>
      {/* fen is shared by both lines, so a position change clears both — editors only clear their own */}
      {chess.mode === 'study' ? (
        <ChessStudyEditor
          key='study'
          blockId={nodeId}
          payload={study}
          onChange={(p) => set({fen: p.fen, moves: p.moves, ...(p.fen !== chess.fen && {solution: []})})}
        />
      ) : (
        <ChessPuzzleEditor
          key='puzzle'
          blockId={nodeId}
          payload={puzzle}
          onChange={(p) => set({fen: p.fen, solution: p.solution, prompt: p.prompt, ...(p.fen !== chess.fen && {moves: []})})}
        />
      )}
    </div>
  )
}
