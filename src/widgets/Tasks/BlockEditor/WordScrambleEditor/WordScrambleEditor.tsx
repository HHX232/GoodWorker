'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {WordScrambleMode, WordScramblePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors} from '@dnd-kit/core'
import {SortableContext, arrayMove, horizontalListSortingStrategy, useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {CheckCircle2Icon, EyeIcon, PencilIcon, ShuffleIcon, XCircleIcon} from 'lucide-react'
import {useMemo, useState} from 'react'
import styles from './WordScrambleEditor.module.scss'
import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'

// ── утилиты ───────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getShuffledItems(source: string, mode: WordScrambleMode): string[] {
  if (!source.trim()) return []
  const seed = source.length * 7 + source.charCodeAt(0)
  const items = mode === 'letters' ? source.trim().split('') : source.trim().split(/\s+/)
  const shuffled = seededShuffle(items, seed)
  const isSame = shuffled.join('') === items.join('')
  return isSame ? seededShuffle(items, seed + 1) : shuffled
}

// ── SortableTile ──────────────────────────────────────────────────────────────
// checked=undefined  → нейтральный (во время прохождения)
// checked=true       → зелёный (верно)
// checked=false      → красный (неверно)

interface TileProps {
  id: string
  label: string
  dimmed?: boolean
  checked?: boolean | null // null = нейтрально после внешней проверки
}

const SortableTile = ({id, label, dimmed, checked}: TileProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})

  const colorClass = checked === true ? styles.tile_correct : checked === false ? styles.tile_wrong : ''

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1}}
      className={`${styles.tile} ${dimmed ? styles.tile_dimmed : ''} ${colorClass}`}
      {...attributes}
      {...listeners}
    >
      {label}
    </div>
  )
}

// ── StudentView ───────────────────────────────────────────────────────────────
// Используется в двух режимах:
//   standalone (внутри редактора, превью) — кнопка «Проверить» встроена
//   student    (страница прохождения)     — onChange + externally checked через проп

interface StudentViewProps {
  source: string
  mode: WordScrambleMode
  hint: string | null
  shuffledItems: string[]
  // --- пропы для режима прохождения ---
  onChange?: (a: StudentAnswer) => void
  // если передан — блок управляется снаружи (кнопка «Завершить тест»)
  externalChecked?: boolean
}

export const StudentView = ({source, mode, hint, shuffledItems, onChange, externalChecked}: StudentViewProps) => {
  const [tiles, setTiles] = useState<Array<{id: string; label: string}>>(() =>
    shuffledItems.map((label, i) => ({id: `${label}-${i}`, label}))
  )
  // внутренняя проверка (standalone превью)
  const [submitted, setSubmitted] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIdx = tiles.findIndex((t) => t.id === active.id)
    const newIdx = tiles.findIndex((t) => t.id === over.id)
    setTiles((prev) => {
      const next = arrayMove(prev, oldIdx, newIdx)
      // поднимаем ответ наверх если есть onChange
      onChange?.({
        type: TaskBlockType.WORD_SCRAMBLE,
        value: next.map((t) => t.label)
      })
      return next
    })
  }

  const correctItems = mode === 'letters' ? source.trim().split('') : source.trim().split(/\s+/)

  const currentAnswer = tiles.map((t) => t.label).join(mode === 'letters' ? '' : ' ')
  const isCorrect = currentAnswer === source

  // определяем checked для каждого тайла:
  //   - если проверка внешняя (externalChecked) — каждый тайл зелёный/красный
  //   - если внутренняя (submitted) — то же самое
  //   - иначе null (нейтрально)
  const isChecked = submitted || externalChecked === true

  const getTileChecked = (label: string, idx: number): boolean | null => {
    if (!isChecked) return null
    return label === correctItems[idx]
  }

  const reset = () => {
    setTiles(shuffledItems.map((label, i) => ({id: `${label}-${i}`, label})))
    setSubmitted(false)
    onChange?.({type: TaskBlockType.WORD_SCRAMBLE, value: shuffledItems})
  }

  // режим прохождения — нет встроенной кнопки проверки, только drag
  const isStudentMode = !!onChange

  return (
    <div className={styles.student_wrap}>
      {hint && <p className={styles.student_hint_text}>💡 {hint}</p>}

      <p className={styles.student_instruction}>
        {mode === 'letters' ? 'Собери слово из букв:' : 'Составь предложение из слов:'}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiles.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className={styles.tiles_row}>
            {tiles.map((tile, idx) => (
              <SortableTile
                key={tile.id}
                id={tile.id}
                label={tile.label}
                dimmed={isChecked && !isStudentMode}
                checked={getTileChecked(tile.label, idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Текущий ответ — показываем всегда */}
      <div className={styles.current_answer}>
        <span className={styles.current_answer_label}>Сейчас:</span>
        <span
          className={`
          ${styles.current_answer_value}
          ${isChecked ? (isCorrect ? styles.answer_correct : styles.answer_wrong) : ''}
        `}
        >
          {currentAnswer || '—'}
        </span>
      </div>

      {/* Встроенная кнопка — только в standalone превью (не в режиме прохождения) */}
      {!isStudentMode &&
        (!submitted ? (
          <button type='button' className={styles.submit_btn} onClick={() => setSubmitted(true)}>
            Проверить
          </button>
        ) : (
          <div className={styles.result_row}>
            <div className={`${styles.result_badge} ${isCorrect ? styles.result_badge_ok : styles.result_badge_err}`}>
              {isCorrect ? (
                <>
                  <CheckCircle2Icon size={15} /> Верно!
                </>
              ) : (
                <>
                  <XCircleIcon size={15} /> Правильно: <strong>{source}</strong>
                </>
              )}
            </div>
            <button type='button' className={styles.retry_btn} onClick={reset}>
              Попробовать снова
            </button>
          </div>
        ))}

      {/* Результат внешней проверки — показывается после «Завершить тест» */}
      {isStudentMode && externalChecked === true && (
        <div className={styles.result_row}>
          <div className={`${styles.result_badge} ${isCorrect ? styles.result_badge_ok : styles.result_badge_err}`}>
            {isCorrect ? (
              <>
                <CheckCircle2Icon size={15} /> Верно!
              </>
            ) : (
              <>
                <XCircleIcon size={15} /> Правильно: <strong>{source}</strong>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Основной редактор (без изменений в логике) ────────────────────────────────

interface Props {
  blockId: string
  payload: WordScramblePayload
}

export const WordScrambleEditor = ({blockId, payload}: Props) => {
  const {updateBlockPayload} = useActions()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const update = (patch: Partial<WordScramblePayload>) =>
    updateBlockPayload({id: blockId, payload: {...payload, ...patch}})

  const shuffledItems = useMemo(
    () => (payload.source ? getShuffledItems(payload.source, payload.mode) : []),
    [payload.source, payload.mode]
  )

  const canPreview = !!payload.source?.trim()

  return (
    <div className={styles.box}>
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
          title={!canPreview ? 'Введите слово или предложение' : undefined}
        >
          <EyeIcon size={13} /> Превью ученика
        </button>
      </div>

      {mode === 'edit' && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Режим</span>
            <div className={styles.mode_tabs}>
              {(['letters', 'words'] as WordScrambleMode[]).map((m) => (
                <button
                  key={m}
                  type='button'
                  className={`${styles.mode_tab} ${payload.mode === m ? styles.mode_tab_active : ''}`}
                  onClick={() => update({mode: m, source: null})}
                >
                  {m === 'letters' ? '🔤 Буквы слова' : '📝 Слова предложения'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{payload.mode === 'letters' ? 'Слово' : 'Предложение'}</label>
            <input
              className={styles.input}
              placeholder={payload.mode === 'letters' ? 'Например: elephant' : 'Например: She went to the market'}
              value={payload.source ?? ''}
              onChange={(e) => update({source: e.target.value || null})}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Подсказка / перевод (необязательно)</label>
            <input
              className={styles.input}
              placeholder='Например: слон'
              value={payload.hint ?? ''}
              onChange={(e) => update({hint: e.target.value || null})}
            />
          </div>

          {shuffledItems.length > 0 && (
            <div className={styles.editor_preview}>
              <div className={styles.editor_preview_header}>
                <ShuffleIcon size={12} />
                <span className={styles.label}>Перемешанный вид</span>
              </div>
              <div className={styles.tiles_row}>
                {shuffledItems.map((item, i) => (
                  <div key={i} className={`${styles.tile} ${styles.tile_static}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className={styles.answer_row}>
                <span className={styles.answer_label}>Правильный ответ:</span>
                <span className={styles.answer_value}>{payload.source}</span>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'preview' && canPreview && (
        <div className={styles.preview_wrap}>
          <div className={styles.preview_label}>
            <EyeIcon size={13} /> Так видит ученик
          </div>
          {/* standalone превью — без onChange, со встроенной кнопкой */}
          <StudentView source={payload.source!} mode={payload.mode} hint={payload.hint} shuffledItems={shuffledItems} />
        </div>
      )}
    </div>
  )
}
