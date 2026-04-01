import {NodeViewWrapper} from '@tiptap/react'
import styles from './InputTaskGapComponent.module.scss'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const InputTaskGapComponent = ({node, updateAttributes, extension}: any) => {
  const answer = node.attrs.answer
  const onChangeAnswer = extension?.options?.onChangeAnswer
  const isPass = !!onChangeAnswer

  if (isPass) {
    // ── режим прохождения ──────────────────────────────────────────────────
    return (
      <NodeViewWrapper as='span' className={styles.gap_wrapper}>
        <input
          placeholder='...'
          onChange={(e) => onChangeAnswer(node.attrs.gapId ?? node.attrs.answer, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={styles.gap_input}
          style={{
            width: '80px',
            textAlign: 'center',
            padding: '5px',
            margin: '0 5px',
            borderRadius: '5px',
            backgroundColor: '#868D9720'
          }}
        />
      </NodeViewWrapper>
    )
  }

  // ── режим редактирования ───────────────────────────────────────────────────
  return (
    <NodeViewWrapper as='span' className={styles.gap_wrapper}>
      <input
        value={answer}
        onChange={(e) => updateAttributes({answer: e.target.value})}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder='ответ'
        className={styles.gap_input}
        style={{
          width: `${Math.max(60, answer.length * 11 + 14)}px`,
          textAlign: 'center',
          padding: '5px',
          margin: '0 5px',
          borderRadius: '5px',
          backgroundColor: '#868D9720'
        }}
      />
    </NodeViewWrapper>
  )
}
