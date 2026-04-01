'use client'
import {closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {NodeViewWrapper, ReactNodeViewProps} from '@tiptap/react'
import {ChevronDownIcon, GripVerticalIcon, PlusIcon, XIcon} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import styles from './SelectGapNode.module.scss'

// ─── Sortable row ─────────────────────────────────────────────────────────────

interface SortableOptionProps {
  id: string
  index: number
  option: string
  onRemove: () => void
}

const SortableOption = ({id, index, option, onRemove}: SortableOptionProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})

  const itemStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <li
      ref={setNodeRef}
      style={itemStyle}
      className={`${styles.option_item} ${index === 0 ? styles.option_item_correct : ''}`}
    >
      <button type='button' className={styles.drag_handle} {...attributes} {...listeners}>
        <GripVerticalIcon size={12} />
      </button>
      <span className={styles.option_num}>{index + 1}</span>
      <span className={styles.option_text}>{option}</span>
      {index === 0 && <span className={styles.correct_badge}>верный ответ</span>}
      <button type='button' className={styles.remove_btn} onClick={onRemove}>
        <XIcon size={11} />
      </button>
    </li>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

// Используем ReactNodeViewProps напрямую — так TS не ругается на несовместимость attrs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SelectTaskGapComponent = ({node, updateAttributes, extension}: ReactNodeViewProps & {extension?: any}) => {
  const options: string[] = (node.attrs.options as string[]) ?? []
  const onChangeAnswer = extension?.options?.onChangeAnswer
  const isPass = !!onChangeAnswer
  const isEmpty = options.length === 0

  const [open, setOpen] = useState(isEmpty)
  const [inputValue, setInputValue] = useState('')

  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  // фокус в инпут при открытии
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  // закрыть по клику вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const addOption = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || options.includes(trimmed)) return
    updateAttributes({options: [...options, trimmed]})
    setInputValue('')
  }

  const removeOption = (idx: number) => {
    updateAttributes({options: options.filter((_, i) => i !== idx)})
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event
    if (!over || active.id === over.id) return
    const oldIndex = options.indexOf(active.id as string)
    const newIndex = options.indexOf(over.id as string)
    updateAttributes({options: arrayMove(options, oldIndex, newIndex)})
  }

  if (isPass) {
    return (
      <NodeViewWrapper as='span' contentEditable={false}>
        <select
          defaultValue=''
          onChange={(e) => onChangeAnswer(node.attrs.gapId ?? options[0], e.target.value)}
          style={{
            padding: '3px 8px',
            fontSize: 15,
            border: '1.5px solid #c4c8d0',
            borderRadius: 6,
            background: '#f0f1f3',
            margin: '0 4px',
            cursor: 'pointer'
          }}
        >
          <option value='' disabled>
            —
          </option>
          {/* перемешиваем чтобы правильный не был первым визуально */}
          {[...options]
            // eslint-disable-next-line react-hooks/purity
            .sort(() => Math.random() - 0.5)
            .map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
        </select>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as='span' className={styles.wrapper} contentEditable={false}>
      {/* ── Чип в тексте ── */}
      <button
        type='button'
        className={`${styles.chip} ${isEmpty ? styles.chip_empty : styles.chip_filled}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.chip_label}>{isEmpty ? 'выбрать...' : options[0]}</span>
        <ChevronDownIcon size={11} className={`${styles.chip_chevron} ${open ? styles.chip_chevron_open : ''}`} />
      </button>

      {/* ── Попап ── */}
      {open && (
        <div ref={popoverRef} className={styles.popover}>
          <p className={styles.popover_title}>Варианты ответа</p>

          {options.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={options} strategy={verticalListSortingStrategy}>
                <ul className={styles.option_list}>
                  {options.map((opt, idx) => (
                    <SortableOption key={opt} id={opt} index={idx} option={opt} onRemove={() => removeOption(idx)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {/* ── Строка добавления ── */}
          <div className={styles.add_row}>
            <input
              ref={inputRef}
              className={styles.add_input}
              placeholder='Новый вариант...'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addOption()
                }
              }}
            />
            <button type='button' className={styles.add_btn} onClick={addOption} disabled={!inputValue.trim()}>
              <PlusIcon size={14} />
            </button>
          </div>

          {options.length > 0 && <p className={styles.hint}>Перетащите чтобы изменить порядок · Первый — правильный</p>}
        </div>
      )}
    </NodeViewWrapper>
  )
}
