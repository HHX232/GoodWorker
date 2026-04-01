/* eslint-disable @typescript-eslint/no-explicit-any */
// OtherBlocks/ActiveTestBlock/ActiveTestBlock.tsx
'use client'
import {TestPlayer} from '@/_pages/TestPages/TestPlayer/TestPlayer'
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {useActions} from '@/features/hooks/store/useActions'
import {useTypedSelector} from '@/features/hooks/store/useTypedSelector'
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {useReactFlow, useStore} from '@xyflow/react'
import {useEffect, useState} from 'react'
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

const TYPE_LABELS: Record<string, string> = {
  [TaskBlockType.CHOOSE_OPTION]: 'Выбор варианта',
  [TaskBlockType.FREE_ANSWER]: 'Свободный ответ',
  [TaskBlockType.FILL_TEXT]: 'Заполнить пропуски',
  [TaskBlockType.SEQUENCE]: 'Последовательность',
  [TaskBlockType.MATCH_PAIRS]: 'Сопоставить пары',
  [TaskBlockType.HIGHLIGHT_TEXT]: 'Выделить слова',
  [TaskBlockType.WORD_SCRAMBLE]: 'Собрать слово',
  [TaskBlockType.DIALOGUE]: 'Диалог'
}

export default function ActiveTestBlock({nodeId, onlyPass = false}: {nodeId: string; onlyPass?: boolean}) {
  const {updateNodeData} = useReactFlow()
  const {loadBlocksForNode, addActiveBlock, removeActiveBlock} = useActions()

  const nodeBlocks = useStore(
    (s) => ((s.nodeLookup.get(nodeId)?.data as RoadNodeData)?.activeTests ?? []) as TestBlock[]
  )

  const {blocks, activeNodeId} = useTypedSelector((s) => s.activeTestSlice)
  const [activeIdx, setActiveIdx] = useState(0)
  const [selectedType, setSelectedType] = useState<TaskBlockType>(TaskBlockType.CHOOSE_OPTION)

  // Загружаем блоки из nodeData в slice при маунте или смене ноды
  useEffect(() => {
    loadBlocksForNode({nodeId, blocks: nodeBlocks})
    setActiveIdx(0)
  }, [nodeId])

  // Синхронизируем slice → nodeData при каждом изменении блоков
  useEffect(() => {
    if (activeNodeId !== nodeId) return
    updateNodeData(nodeId, {activeTests: blocks} as any)
  }, [blocks, activeNodeId, nodeId])

  const handleAdd = () => {
    addActiveBlock(selectedType)
    setActiveIdx(blocks.length) // станет последним
  }

  const handleRemove = (id: string) => {
    removeActiveBlock(id)
    setActiveIdx((prev) => Math.min(prev, blocks.length - 2))
  }

  const current = blocks[activeIdx] ?? null
  if (onlyPass) {
    return (
      <div className={`${styles.wrap} nodrag nopan`}>
        {nodeBlocks.length === 0 ? (
          <p className={styles.empty}>Нет вопросов</p>
        ) : (
          <TestPlayer showInlineResult blocks={nodeBlocks} singleBlock onResult={(res) => console.log(res)} />
        )}
      </div>
    )
  }
  return (
    <div className={`${styles.wrap} nodrag nopan`}>
      {/* ── Добавление блока ── */}
      <div className={styles.add_row}>
        <select
          className={styles.type_select}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as TaskBlockType)}
        >
          {AVAILABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button type='button' className={styles.add_btn} onClick={handleAdd}>
          + Добавить
        </button>
      </div>

      {blocks.length === 0 && <p className={styles.empty}>Добавьте первый блок</p>}

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
                <span className={styles.block_type}>{TYPE_LABELS[current.type]}</span>
                <button type='button' className={styles.remove_btn} onClick={() => handleRemove(current.id)}>
                  Удалить
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
