// features/test-block-editor/ui/editors/DialogueEditor/DialogueEditor.tsx
'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {DialogueLine, DialoguePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {CheckCircle2Icon, EyeIcon, GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon, XCircleIcon} from 'lucide-react'
import {useState} from 'react'
import styles from './DialogueEditor.module.scss'

interface Props {
  blockId: string
  payload: DialoguePayload
}

const uid = () => Math.random().toString(36).slice(2, 8)

const COLOR_A = '#3b82f6'
const COLOR_B = '#10b981'

interface BubbleProps {
  line: DialogueLine
  nameA: string
  nameB: string
  dimmed?: boolean
}

const Bubble = ({line, nameA, nameB, dimmed}: BubbleProps) => {
  const isB = line.speaker === 'b'
  const name = isB ? nameB : nameA
  const color = isB ? COLOR_B : COLOR_A

  return (
    <div className={`${styles.bubble_row} ${isB ? styles.bubble_row_right : ''} ${dimmed ? styles.bubble_dimmed : ''}`}>
      <div className={styles.avatar} style={{background: color}}>
        {name?.[0]?.toUpperCase() ?? '?'}
      </div>

      <div
        className={`${styles.bubble} ${isB ? styles.bubble_right : styles.bubble_left}`}
        style={
          isB
            ? {background: color, color: '#fff'}
            : {borderColor: color + '50', background: color + '10', color: '#1e293b'}
        }
      >
        <span className={styles.bubble_author} style={{color: isB ? 'rgba(255,255,255,0.8)' : color}}>
          {name || (isB ? 'Персонаж B' : 'Персонаж A')}
        </span>
        <p className={styles.bubble_text}>{line.text || <em className={styles.bubble_empty}>пусто</em>}</p>
      </div>
    </div>
  )
}

// ── Sortable строка реплики (редактор) ────────────────────────────────────────
interface SortableLineProps {
  line: DialogueLine
  nameA: string
  nameB: string
  onUpdate: (patch: Partial<DialogueLine>) => void
  onRemove: () => void
}

const SortableLine = ({line, nameA, nameB, onUpdate, onRemove}: SortableLineProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: line.id})

  const isB = line.speaker === 'b'
  const color = isB ? COLOR_B : COLOR_A

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1}}
      className={styles.line_row}
    >
      {/* Drag handle */}
      <button type='button' className={styles.drag_handle} {...attributes} {...listeners}>
        <GripVerticalIcon size={13} />
      </button>

      {/* Переключатель A / B */}
      <div className={styles.speaker_toggle}>
        <button
          type='button'
          className={`${styles.speaker_btn} ${!isB ? styles.speaker_btn_active : ''}`}
          style={!isB ? {background: COLOR_A + '18', borderColor: COLOR_A, color: COLOR_A} : {}}
          onClick={() => onUpdate({speaker: 'a'})}
        >
          {nameA || 'A'}
        </button>
        <button
          type='button'
          className={`${styles.speaker_btn} ${isB ? styles.speaker_btn_active : ''}`}
          style={isB ? {background: COLOR_B + '18', borderColor: COLOR_B, color: COLOR_B} : {}}
          onClick={() => onUpdate({speaker: 'b'})}
        >
          {nameB || 'B'}
        </button>
      </div>

      {/* Цветная полоска-индикатор */}
      <div className={styles.line_accent} style={{background: color}} />

      {/* Текст */}
      <input
        className={styles.line_input}
        placeholder='Текст реплики...'
        value={line.text}
        onChange={(e) => onUpdate({text: e.target.value})}
      />

      {/* Удалить */}
      <button type='button' className={styles.remove_btn} onClick={onRemove}>
        <Trash2Icon size={13} />
      </button>
    </div>
  )
}

// ── Превью ученика ────────────────────────────────────────────────────────────
interface StudentViewProps {
  payload: DialoguePayload
  onChange?: (ids: string[]) => void
  externalChecked?: boolean
}

const StudentView = ({payload, onChange, externalChecked}: StudentViewProps) => {
  const {lines, speakers, instruction} = payload
  const isStudentMode = !!onChange

  const shuffleOnce = <T,>(arr: T[], seed: number): T[] => {
    const a = [...arr]
    let r = seed
    for (let i = a.length - 1; i > 0; i--) {
      r = (r * 1664525 + 1013904223) & 0xffffffff
      const j = Math.abs(r) % (i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const seed = lines.length * 17 + (lines[0]?.text.charCodeAt(0) ?? 5)
  const [tiles, setTiles] = useState<DialogueLine[]>(() => shuffleOnce(lines, seed))
  const [submittedInternal, setSubmittedInternal] = useState(false)

  const isChecked = submittedInternal || externalChecked === true
  const isCorrect = tiles.every((t, i) => t.id === lines[i].id)

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    if (isChecked) return
    const {active, over} = e
    if (!over || active.id === over.id) return
    setTiles((prev) => {
      const o = prev.findIndex((t) => t.id === active.id)
      const n = prev.findIndex((t) => t.id === over.id)
      const next = arrayMove(prev, o, n)
      onChange?.(next.map((t) => t.id)) // поднимаем ответ
      return next
    })
  }

  const reset = () => {
    const reshuffled = shuffleOnce(lines, seed + 1)
    setTiles(reshuffled)
    setSubmittedInternal(false)
    onChange?.(reshuffled.map((t) => t.id))
  }

  return (
    <div className={styles.student_wrap}>
      {instruction && <p className={styles.student_instruction}>{instruction}</p>}
      <p className={styles.student_meta}>Перетащи реплики в правильном порядке</p>

      <div className={styles.legend}>
        {(['a', 'b'] as const).map((sp) => (
          <div key={sp} className={styles.legend_item}>
            <div className={styles.legend_dot} style={{background: sp === 'a' ? COLOR_A : COLOR_B}} />
            <span>{sp === 'a' ? speakers.a || 'Персонаж A' : speakers.b || 'Персонаж B'}</span>
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiles.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.student_tiles}>
            {tiles.map((line, idx) => {
              const color = line.speaker === 'b' ? COLOR_B : COLOR_A
              const name = line.speaker === 'b' ? speakers.b : speakers.a
              return (
                <StudentTile
                  key={line.id}
                  line={line}
                  name={name}
                  color={color}
                  correctPos={isChecked && line.id === lines[idx].id}
                  wrongPos={isChecked && line.id !== lines[idx].id}
                  disabled={isChecked}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Кнопка проверки — только в standalone превью */}
      {!isStudentMode && !submittedInternal && (
        <button type='button' className={styles.submit_btn} onClick={() => setSubmittedInternal(true)}>
          Проверить
        </button>
      )}

      {/* Результат */}
      {isChecked && (
        <div className={styles.result_row}>
          <div className={`${styles.result_badge} ${isCorrect ? styles.badge_ok : styles.badge_err}`}>
            {isCorrect ? (
              <>
                <CheckCircle2Icon size={15} /> Правильно!
              </>
            ) : (
              <>
                <XCircleIcon size={15} /> Не совсем
              </>
            )}
          </div>
          {/* Кнопка «Заново» только в standalone */}
          {!isStudentMode && (
            <button type='button' className={styles.retry_btn} onClick={reset}>
              Заново
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sortable тайл ученика ─────────────────────────────────────────────────────
interface StudentTileProps {
  line: DialogueLine
  name: string
  color: string
  correctPos: boolean
  wrongPos: boolean
  disabled: boolean
}

const StudentTile = ({line, name, color, correctPos, wrongPos, disabled}: StudentTileProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: line.id})

  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1}}
      className={`
        ${styles.student_tile}
        ${correctPos ? styles.tile_correct : ''}
        ${wrongPos ? styles.tile_wrong : ''}
        ${disabled ? styles.tile_disabled : ''}
      `}
    >
      <div className={styles.student_tile_handle} {...(disabled ? {} : {...attributes, ...listeners})}>
        <GripVerticalIcon size={12} />
      </div>

      {/* Цветная полоска слева = участник */}
      <div className={styles.tile_stripe} style={{background: color}} />

      <div className={styles.tile_body}>
        <span className={styles.tile_author} style={{color}}>
          {name || '—'}
        </span>
        <p className={styles.tile_text}>{line.text}</p>
      </div>
    </div>
  )
}

// ── Основной редактор ─────────────────────────────────────────────────────────
export const DialogueEditor = ({blockId, payload}: Props) => {
  const {updateBlockPayload} = useActions()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const update = (patch: Partial<DialoguePayload>) => updateBlockPayload({id: blockId, payload: {...payload, ...patch}})

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const addLine = () => {
    // чередуем A/B автоматически
    const lastSpeaker = payload.lines.at(-1)?.speaker ?? 'b'
    update({
      lines: [...payload.lines, {id: uid(), speaker: lastSpeaker === 'a' ? 'b' : 'a', text: ''}]
    })
  }

  const updateLine = (id: string, patch: Partial<DialogueLine>) =>
    update({lines: payload.lines.map((l) => (l.id === id ? {...l, ...patch} : l))})

  const removeLine = (id: string) => update({lines: payload.lines.filter((l) => l.id !== id)})

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    const o = payload.lines.findIndex((l) => l.id === active.id)
    const n = payload.lines.findIndex((l) => l.id === over.id)
    update({lines: arrayMove(payload.lines, o, n)})
  }

  const canPreview = payload.lines.length >= 2 && payload.lines.every((l) => l.text.trim())
  const hasAnyText = payload.lines.some((l) => l.text.trim())

  return (
    <div className={styles.box}>
      {/* ── Переключатель ── */}
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
          title={!canPreview ? 'Заполните все реплики (минимум 2)' : undefined}
        >
          <EyeIcon size={13} /> Превью ученика
        </button>
      </div>

      {/* ════ РЕДАКТОР ════ */}
      {mode === 'edit' && (
        <>
          {/* Инструкция */}
          <div className={styles.field}>
            <label className={styles.label}>Инструкция</label>
            <input
              className={styles.input}
              placeholder='Например: «Расставь реплики в правильном порядке»'
              value={payload.instruction ?? ''}
              onChange={(e) => update({instruction: e.target.value || null})}
            />
          </div>

          {/* ── Имена участников ── */}
          <div className={styles.field}>
            <span className={styles.label}>Участники</span>
            <div className={styles.speakers_row}>
              <div className={styles.speaker_field}>
                <div className={styles.speaker_dot} style={{background: COLOR_A}} />
                <input
                  className={styles.speaker_input}
                  placeholder='Имя персонажа A'
                  value={payload.speakers.a}
                  onChange={(e) => update({speakers: {...payload.speakers, a: e.target.value}})}
                  style={{borderColor: COLOR_A + '60'}}
                />
                <span className={styles.speaker_side_tag} style={{background: COLOR_A + '15', color: COLOR_A}}>
                  ← слева
                </span>
              </div>

              <div className={styles.speaker_field}>
                <div className={styles.speaker_dot} style={{background: COLOR_B}} />
                <input
                  className={styles.speaker_input}
                  placeholder='Имя персонажа B'
                  value={payload.speakers.b}
                  onChange={(e) => update({speakers: {...payload.speakers, b: e.target.value}})}
                  style={{borderColor: COLOR_B + '60'}}
                />
                <span className={styles.speaker_side_tag} style={{background: COLOR_B + '15', color: COLOR_B}}>
                  справа →
                </span>
              </div>
            </div>
          </div>

          {/* ── Реплики ── */}
          <div className={styles.field}>
            <div className={styles.lines_header}>
              <span className={styles.label}>Реплики диалога</span>
              <button type='button' className={styles.add_btn} onClick={addLine}>
                <PlusIcon size={13} /> Добавить реплику
              </button>
            </div>

            {payload.lines.length === 0 && <p className={styles.empty_hint}>Добавьте первую реплику</p>}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={payload.lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.lines_list}>
                  {payload.lines.map((line) => (
                    <SortableLine
                      key={line.id}
                      line={line}
                      nameA={payload.speakers.a || 'A'}
                      nameB={payload.speakers.b || 'B'}
                      onUpdate={(patch) => updateLine(line.id, patch)}
                      onRemove={() => removeLine(line.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* ── Превью чата ── */}
          {hasAnyText && (
            <div className={styles.field}>
              <span className={styles.label}>Предварительный просмотр</span>
              <div className={styles.chat_box}>
                {payload.lines.map((line) => (
                  <Bubble
                    key={line.id}
                    line={line}
                    nameA={payload.speakers.a || 'Персонаж A'}
                    nameB={payload.speakers.b || 'Персонаж B'}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════ ПРЕВЬЮ УЧЕНИКА ════ */}
      {mode === 'preview' && canPreview && (
        <div className={styles.preview_wrap}>
          <div className={styles.preview_label}>
            <EyeIcon size={13} /> Так видит ученик
          </div>
          <StudentView payload={payload} />
        </div>
      )}
    </div>
  )
}

export {StudentView as DialogueStudentView}
