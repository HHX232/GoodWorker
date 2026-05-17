'use client'
import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {WordScrambleMode, WordScramblePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors} from '@dnd-kit/core'
import {SortableContext, arrayMove, horizontalListSortingStrategy, useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {CheckCircle2Icon, LightbulbIcon, XCircleIcon} from 'lucide-react'
import {useState} from 'react'
import styles from '../WordScrambleEditor.module.scss'

export function seededShuffle<T>(arr: T[], seed: number): T[] {
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

interface TileProps {
  id: string
  label: string
  dimmed?: boolean
  checked?: boolean | null
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
//   standalone (внутри редактора) — кнопка Проверить встроена
//   student    (страница прохождения)     — onChange + externally checked через проп

interface StudentViewProps {
  source: string
  mode: WordScrambleMode
  hint: string | null
  shuffledItems: string[]
  // --- пропы для режима прохождения ---
  onChange?: (a: StudentAnswer) => void
  externalChecked?: boolean
}

export const StudentViewWordScramble = ({
  source,
  mode,
  hint,
  shuffledItems,
  onChange,
  externalChecked
}: StudentViewProps) => {
  const [tiles, setTiles] = useState<Array<{id: string; label: string}>>(() =>
    shuffledItems.map((label, i) => ({id: `${label}-${i}`, label}))
  )
  const [submitted, setSubmitted] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const oldIdx = tiles.findIndex((t) => t.id === active.id)
    const newIdx = tiles.findIndex((t) => t.id === over.id)
    setTiles((prev) => {
      const next = arrayMove(prev, oldIdx, newIdx)
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

  const isStudentMode = !!onChange

  return (
    <div className={styles.student_wrap}>
      {hint && <p className={styles.student_hint_text}><LightbulbIcon size={14} /> {hint}</p>}

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
