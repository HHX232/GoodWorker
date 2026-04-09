'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {MatchPairsPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {nanoid} from '@reduxjs/toolkit'
import {useState} from 'react'
import styles from './MatchPairsEditor.module.scss'
import {MatchConnector} from './MatchConnector/MatchConnector'

interface Props {
  blockId: string
  payload: MatchPairsPayload
}

function MatchPairsEditor({blockId, payload}: Props) {
  const {updateBlockPayload} = useActions()
  const [previewMatches, setPreviewMatches] = useState<Map<string, string>>(new Map())

  const update = (updated: Partial<MatchPairsPayload>) => {
    updateBlockPayload({
      id: blockId,
      payload: {...payload, ...updated}
    })
  }

  const addPair = () => {
    update({
      pairs: [...payload.pairs, {id: nanoid(), left: '', right: ''}]
    })
  }

  const removePair = (id: string) => {
    update({pairs: payload.pairs.filter((p) => p.id !== id)})
  }

  const updatePair = (id: string, side: 'left' | 'right', value: string) => {
    update({
      pairs: payload.pairs.map((p) => (p.id === id ? {...p, [side]: value} : p))
    })
  }

  // Перемешиваем правые элементы для превью соединения
  const rightItems = [...payload.pairs]
    .sort(() => 0) // порядок как есть, можно shuffle при желании
    .map((p) => ({id: p.id, content: p.right}))

  const leftItems = payload.pairs.map((p) => ({id: p.id, content: p.left}))

  return (
    <div className={styles.editor_box}>
      <div className={styles.pairs_list}>
        <div className={styles.pairs_header}>
          <span>Левая часть</span>
          <span>Правая часть</span>
        </div>

        {payload.pairs.map((pair, index) => (
          <div key={pair.id} className={styles.pair_row}>
            <span className={styles.pair_index}>{index + 1}</span>

            <input
              className={styles.pair_input}
              value={pair.left}
              onChange={(e) => updatePair(pair.id, 'left', e.target.value)}
              placeholder={`Левый элемент ${index + 1}`}
            />

            <div className={styles.pair_arrow}>→</div>

            <input
              className={styles.pair_input}
              value={pair.right}
              onChange={(e) => updatePair(pair.id, 'right', e.target.value)}
              placeholder={`Правый элемент ${index + 1}`}
            />

            <button type='button' className={styles.remove_btn} onClick={() => removePair(pair.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <button type='button' className={styles.add_btn} onClick={addPair}>
        + Добавить пару
      </button>

      {payload.pairs.length >= 2 && (
        <div className={styles.preview_box}>
          <span className={styles.preview_label}>Превью для ученика</span>
          <MatchConnector
            gradientId={`grad-${blockId}`}
            leftItems={leftItems}
            rightItems={rightItems}
            matches={previewMatches}
            onMatchesChange={setPreviewMatches}
          />
        </div>
      )}
    </div>
  )
}

export default MatchPairsEditor
