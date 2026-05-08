/* eslint-disable @typescript-eslint/no-explicit-any */
// OtherBlocks/ActiveTestBlock/ActiveTestBlock.tsx
'use client'

import {TestPlayer} from '@/_pages/TestPages/TestPlayer/TestPlayer'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useRoadmapAccessContext} from '@/shared/ui/RoadMap/context/RoadmapAccessContext'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useReactFlow, useStore} from '@xyflow/react'
import {useCallback, useEffect, useState} from 'react'
import styles from './ActiveTestParam.module.scss'
import {BlockEditorSwitch} from './BlockEditorInline/BlockEditorSwitch'

const AVAILABLE_TYPES: TaskBlockType[] = [
  TaskBlockType.CHOOSE_OPTION,
  TaskBlockType.FREE_ANSWER,
  TaskBlockType.FILL_TEXT,
  TaskBlockType.SEQUENCE,
  TaskBlockType.MATCH_PAIRS,
  TaskBlockType.HIGHLIGHT_TEXT,
  TaskBlockType.WORD_SCRAMBLE,
  TaskBlockType.DIALOGUE
]

export const TYPE_KEYS: Record<string, string> = {
  [TaskBlockType.CHOOSE_OPTION]: 'chooseOption',
  [TaskBlockType.FREE_ANSWER]: 'freeAnswer',
  [TaskBlockType.FILL_TEXT]: 'fillText',
  [TaskBlockType.SEQUENCE]: 'sequence',
  [TaskBlockType.MATCH_PAIRS]: 'matchPairs',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'highlightText',
  [TaskBlockType.WORD_SCRAMBLE]: 'wordScramble',
  [TaskBlockType.DIALOGUE]: 'dialogue'
}

export default function ActiveTestBlock({
  nodeId,
  onlyPass = false,
  t
}: {
  nodeId: string
  onlyPass?: boolean
  t: (v: string) => string
}) {
  const {updateNodeData} = useReactFlow()
  const {loadBlocksForNode, addActiveBlock, removeActiveBlock} = useActions()
  const {roadmapId} = useRoadmapAccessContext()

  const nodeBlocks = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.activeTests ?? []) as TestBlock[]
  )

  const {blocksByNode, activeNodeId} = useTypedSelector((s) => s.activeTestSlice)
  const isActive = activeNodeId === nodeId
  const blocks = blocksByNode[nodeId] ?? nodeBlocks
  const [activeIdx, setActiveIdx] = useState(0)
  const [selectedType, setSelectedType] = useState<TaskBlockType>(TaskBlockType.CHOOSE_OPTION)
  useEffect(() => {
    if (!isActive) return
    updateNodeData(nodeId, {activeTests: blocks} as any)
  }, [blocks, isActive, nodeId])

  useEffect(() => {
    loadBlocksForNode({nodeId, blocks: nodeBlocks})
    setActiveIdx(0)
  }, [nodeId])

  useEffect(() => {
    if (activeNodeId !== nodeId) return
    updateNodeData(nodeId, {activeTests: blocks} as any)
  }, [blocks, activeNodeId, nodeId])

  const handleAdd = () => {
    addActiveBlock(selectedType)
    setActiveIdx(blocks.length)
  }

  const handleRemove = (id: string) => {
    removeActiveBlock(id)
    setActiveIdx((prev) => Math.min(prev, blocks.length - 2))
  }

  const current = blocks[activeIdx] ?? null

  const handleResult = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res: any) => {
      if (!roadmapId) return
      fetch(`/api/roadmap/${roadmapId}/feedback`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          nodeId,
          answers: {
            percent: res?.percent ?? null,
            score: res?.totalScore ?? null,
            maxScore: res?.maxScore ?? null,
          },
        }),
      }).catch(() => {})
    },
    [roadmapId, nodeId]
  )

  if (onlyPass) {
    return (
      <div className={`${styles.wrap} nodrag nopan`}>
        {nodeBlocks.length === 0 ? (
          <p className={styles.empty}>{t('noQuestions')}</p>
        ) : (
          <TestPlayer showInlineResult blocks={nodeBlocks} singleBlock onResult={handleResult} />
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.wrap} nodrag nopan`}>
      <div className={styles.add_row}>
        <select
          className={styles.type_select}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as TaskBlockType)}
        >
          {AVAILABLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(TYPE_KEYS[type])}
            </option>
          ))}
        </select>

        <button type='button' className={styles.add_btn} onClick={handleAdd}>
          + {t('addButton')}
        </button>
      </div>

      {blocks.length === 0 && <p className={styles.empty}>{t('addFirstBlock')}</p>}

      {blocks.length > 0 && (
        <>
          {/* ── Навигация ── */}
          <div className={styles.nav}>
            <button
              type='button'
              className={styles.nav_btn}
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((i) => i - 1)}
            >
              ←
            </button>

            <div className={styles.pills}>
              {blocks.map((b, i) => (
                <button
                  key={b.id}
                  type='button'
                  className={`${styles.pill} ${i === activeIdx ? styles.pill_active : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              type='button'
              className={styles.nav_btn}
              disabled={activeIdx === blocks.length - 1}
              onClick={() => setActiveIdx((i) => i + 1)}
            >
              →
            </button>
          </div>

          {/* ── Текущий блок ── */}
          {current && (
            <div className={styles.block_wrap}>
              <div className={styles.block_header}>
                <span className={styles.block_type}> {t(TYPE_KEYS[current.type])}</span>

                <button type='button' className={styles.remove_btn} onClick={() => handleRemove(current.id)}>
                  {t('delete')}
                </button>
              </div>

              <BlockEditorSwitch block={current} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
