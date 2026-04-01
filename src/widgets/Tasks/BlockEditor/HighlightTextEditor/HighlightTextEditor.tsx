// features/test-block-editor/ui/editors/HighlightTextEditor/HighlightTextEditor.tsx
'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {HighlightTextPayload, HighlightToken} from '@/shared/types/Tasks/TaskPayload.type'
import {CheckCircle2Icon, EyeIcon, PencilIcon, XCircleIcon} from 'lucide-react'
import {useState} from 'react'
import styles from './HighlightTextEditor.module.scss'

interface Props {
  blockId: string
  payload: HighlightTextPayload
}

function tokenize(text: string): HighlightToken[] {
  const parts = text.match(/[\wА-Яа-яЁёA-Za-z'-]+|[^\wА-Яа-яЁё\s]/g) ?? []
  return parts.map((text, id) => ({id, text, isCorrect: false}))
}

interface StudentViewProps {
  instruction: string | null
  tokens: HighlightToken[]
  onChange?: (selected: number[]) => void
  externalChecked?: boolean
}

export const HighlightStudentView = ({instruction, tokens, onChange, externalChecked}: StudentViewProps) => {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const isStudentMode = !!onChange
  const isChecked = submitted || externalChecked === true

  const toggle = (id: number) => {
    if (isChecked) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange?.([...next])
      return next
    })
  }

  const reset = () => {
    setSelected(new Set())
    setSubmitted(false)
    onChange?.([])
  }

  const correctIds = new Set(tokens.filter((t) => t.isCorrect).map((t) => t.id))

  const truePositives = isChecked ? [...selected].filter((id) => correctIds.has(id)).length : 0
  const falsePositives = isChecked ? [...selected].filter((id) => !correctIds.has(id)).length : 0
  const missed = isChecked ? [...correctIds].filter((id) => !selected.has(id)).length : 0
  const allCorrect = isChecked && falsePositives === 0 && missed === 0

  return (
    <div className={styles.student_wrap}>
      {instruction && <p className={styles.student_instruction}>{instruction}</p>}

      <div className={styles.tokens}>
        {tokens.map((token) => {
          const isPunct = /^[^\wА-Яа-яЁёA-Za-z]$/.test(token.text)
          if (isPunct)
            return (
              <span key={token.id} className={styles.punct}>
                {token.text}
              </span>
            )

          const isSelected = selected.has(token.id)
          const isCorrectAndSelected = isChecked && token.isCorrect && isSelected
          const isFalse = isChecked && !token.isCorrect && isSelected
          // пропущенные — НЕ помечаем (по условию задачи)

          return (
            <button
              key={token.id}
              type='button'
              onClick={() => toggle(token.id)}
              className={`
                ${styles.token}
                ${isSelected && !isChecked ? styles.token_selected : ''}
                ${isCorrectAndSelected ? styles.token_correct : ''}
                ${isFalse ? styles.token_false : ''}
              `}
            >
              {token.text}
            </button>
          )
        })}
      </div>

      {/* Кнопка проверки — только в standalone превью */}
      {!isStudentMode && !submitted && (
        <button
          type='button'
          className={styles.submit_btn}
          onClick={() => setSubmitted(true)}
          disabled={selected.size === 0}
        >
          Проверить
        </button>
      )}

      {/* Результат после проверки */}
      {isChecked && (
        <div className={styles.result_row}>
          <div className={`${styles.result_badge} ${allCorrect ? styles.result_badge_ok : styles.result_badge_err}`}>
            {allCorrect ? (
              <>
                <CheckCircle2Icon size={15} /> Верно!
              </>
            ) : (
              <>
                <XCircleIcon size={15} /> {truePositives} из {correctIds.size}
                {falsePositives > 0 ? ` · ${falsePositives} лишних` : ''}
              </>
            )}
          </div>
          {/* Кнопка «Попробовать снова» — только в standalone */}
          {!isStudentMode && (
            <button type='button' className={styles.retry_btn} onClick={reset}>
              Попробовать снова
            </button>
          )}
        </div>
      )}
    </div>
  )
}
export const HighlightTextEditor = ({blockId, payload}: Props) => {
  const {updateBlockPayload} = useActions()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [draft, setDraft] = useState('')

  const update = (patch: Partial<HighlightTextPayload>) =>
    updateBlockPayload({id: blockId, payload: {...payload, ...patch}})

  const handleApply = () => {
    if (!draft.trim()) return
    update({tokens: tokenize(draft.trim())})
    setDraft('')
  }

  const toggleToken = (id: number) => {
    if (!payload.tokens) return
    update({
      tokens: payload.tokens.map((t) => (t.id === id ? {...t, isCorrect: !t.isCorrect} : t))
    })
  }

  const hasTokens = !!(payload.tokens && payload.tokens.length > 0)
  const correctCount = payload.tokens?.filter((t) => t.isCorrect).length ?? 0
  const canPreview = hasTokens && correctCount > 0

  return (
    <div className={styles.box}>
      {/* ── Переключатель режима ── */}
      <div className={styles.mode_bar}>
        <button
          type='button'
          className={`${styles.mode_btn} ${mode === 'edit' ? styles.mode_btn_active : ''}`}
          onClick={() => setMode('edit')}
        >
          <PencilIcon size={13} /> Редактор
        </button>
        <button
          type='button'
          className={`${styles.mode_btn} ${mode === 'preview' ? styles.mode_btn_active : ''}`}
          onClick={() => setMode('preview')}
          disabled={!canPreview}
          title={!canPreview ? 'Добавьте текст и отметьте хотя бы одно слово' : undefined}
        >
          <EyeIcon size={13} /> Превью ученика
        </button>
      </div>

      {/* ════ РЕЖИМ РЕДАКТОРА ════ */}
      {mode === 'edit' && (
        <>
          {/* Инструкция */}
          <div className={styles.field}>
            <label className={styles.label}>Инструкция для ученика</label>
            <input
              className={styles.input}
              placeholder='Например: «Выдели все глаголы в прошедшем времени»'
              value={payload.instruction ?? ''}
              onChange={(e) => update({instruction: e.target.value || null})}
            />
          </div>

          {/* Ввод текста */}
          {!hasTokens && (
            <div className={styles.field}>
              <label className={styles.label}>Текст задания</label>
              <textarea
                className={styles.textarea}
                placeholder='Введите текст, затем нажмите «Разбить на слова»'
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleApply()
                }}
              />
              <button type='button' className={styles.apply_btn} onClick={handleApply} disabled={!draft.trim()}>
                Разбить на слова →
              </button>
            </div>
          )}

          {/* Токены */}
          {hasTokens && (
            <div className={styles.field}>
              <div className={styles.tokens_header}>
                <label className={styles.label}>Кликни на правильные слова</label>
                <div className={styles.tokens_meta}>
                  {correctCount > 0 ? (
                    <span className={styles.correct_count}>✓ {correctCount} выделено</span>
                  ) : (
                    <span className={styles.warn_count}>ни одного не выделено</span>
                  )}
                  <button type='button' className={styles.reset_btn} onClick={() => update({tokens: null})}>
                    Изменить текст
                  </button>
                </div>
              </div>

              <div className={styles.tokens}>
                {payload.tokens!.map((token) => {
                  const isPunct = /^[^\wА-Яа-яЁёA-Za-z]$/.test(token.text)
                  if (isPunct)
                    return (
                      <span key={token.id} className={styles.punct}>
                        {token.text}
                      </span>
                    )
                  return (
                    <button
                      key={token.id}
                      type='button'
                      onClick={() => toggleToken(token.id)}
                      className={`${styles.token} ${token.isCorrect ? styles.token_correct : ''}`}
                    >
                      {token.text}
                    </button>
                  )
                })}
              </div>

              <p className={styles.editor_hint}>Зелёные — правильные ответы. Нажми ещё раз чтобы снять.</p>
            </div>
          )}
        </>
      )}

      {mode === 'preview' && canPreview && (
        <div className={styles.preview_wrap}>
          <div className={styles.preview_label}>
            <EyeIcon size={13} />
            Так видит ученик
          </div>
          <HighlightStudentView instruction={payload.instruction} tokens={payload.tokens!} />
        </div>
      )}
    </div>
  )
}
