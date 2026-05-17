'use client'

import React from 'react'
import { TaskBlockRegistry } from '@/features'
import { useActions } from '@/features/hooks/store/useActions'
import { useTypedSelector } from '@/features/hooks/store/useTypedSelector'
import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import { TaskBlockType } from '@/shared/types/Tasks/TaskType.type'
import BlockEditor from '@/widgets/Tasks/BlockEditor/BlockEditor'
import styles from './QuickTestBuilder.module.scss'

const BLOCK_TYPES: TaskBlockType[] = [
  TaskBlockType.CHOOSE_OPTION,
  TaskBlockType.FREE_ANSWER,
  TaskBlockType.FILL_TEXT,
  TaskBlockType.SEQUENCE,
  TaskBlockType.MATCH_PAIRS,
  TaskBlockType.HIGHLIGHT_TEXT,
  TaskBlockType.WORD_SCRAMBLE,
  TaskBlockType.DIALOGUE,
  TaskBlockType.INFO_TEXT,
]

interface Props {
  onLaunch: (blocks: TestBlock[]) => void
}

export function QuickTestBuilder({ onLaunch }: Props) {
  const { addBlock, resetConstructor } = useActions()
  const blocks = useTypedSelector(state => state.tasks.blocks)

  return (
    <div className={styles.builder}>
      <div className={styles.typePicker}>
        {BLOCK_TYPES.map(type => {
          const meta = TaskBlockRegistry[type]
          return (
            <button
              key={type}
              className={styles.typeBtn}
              onClick={() => addBlock(type)}
              title={meta.description}
            >
              <span className={styles.typeBtnIcon}>{meta.icon}</span>
              <span className={styles.typeBtnLabel}>{meta.label}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.blockList}>
        {blocks.length === 0 ? (
          <p className={styles.emptyHint}>Нажмите на тип блока выше, чтобы добавить</p>
        ) : (
          blocks.map((block: TestBlock) => (
            <div key={block.id} className={styles.blockWrap}>
              <BlockEditor block={block} />
            </div>
          ))
        )}
      </div>

      <div className={styles.actions}>
        {blocks.length > 0 && (
          <button className={styles.clearBtn} onClick={() => resetConstructor()}>
            Очистить
          </button>
        )}
        <button
          className={styles.launchBtn}
          disabled={blocks.length === 0}
          onClick={() => onLaunch(blocks)}
        >
          ▶ Запустить
        </button>
      </div>
    </div>
  )
}
