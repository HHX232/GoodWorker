'use client'

/**
 * StudentViews.tsx
 *
 * Переиспользуемые компоненты прохождения для каждого типа блока.
 * Каждый принимает payload блока + onChange(answer) наружу.
 * Используются в TakeTestPage вместо плейсхолдеров.
 */

import {closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVerticalIcon} from 'lucide-react'
import {useState} from 'react'

import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import type {
  ChooseOptionPayload,
  DialogueLine,
  DialoguePayload,
  FreeAnswerPayload,
  HighlightTextPayload,
  MatchPairsPayload,
  SequencePayload,
  WordScramblePayload
} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import styles from './Studentviews.module.scss'
import {MatchConnector} from '@/widgets/Tasks/BlockEditor/MatchPairsEditor/MatchPairsEditor'

// ─────────────────────────────────────────────────────────────────────────────
// Общие утилиты
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// CHOOSE_OPTION
// ─────────────────────────────────────────────────────────────────────────────

export function ChooseOptionStudent({
  payload,
  onChange
}: {
  payload: ChooseOptionPayload
  onChange: (a: StudentAnswer) => void
}) {
  const isMulti = Array.isArray(payload.correctId)
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    const next = isMulti ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]) : [id]
    setSelected(next)
    onChange({
      type: TaskBlockType.CHOOSE_OPTION,
      value: isMulti ? next : next[0] ?? ''
    })
  }

  return (
    <div className={styles.block}>
      <p className={styles.question}>{payload.question}</p>
      <div className={styles.options}>
        {payload.options.map((opt) => (
          <button
            key={opt.id}
            type='button'
            className={`${styles.option} ${selected.includes(opt.id) ? styles.selected : ''}`}
            onClick={() => toggle(opt.id)}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FREE_ANSWER
// ─────────────────────────────────────────────────────────────────────────────

export function FreeAnswerStudent({
  payload,
  onChange
}: {
  payload: FreeAnswerPayload
  onChange: (a: StudentAnswer) => void
}) {
  const [value, setValue] = useState('')

  return (
    <div className={styles.block}>
      <p className={styles.question}>{payload.question}</p>
      <textarea
        className={styles.textarea}
        rows={4}
        placeholder='Введите ответ...'
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onChange({type: TaskBlockType.FREE_ANSWER, value: e.target.value})
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE
// ─────────────────────────────────────────────────────────────────────────────

function SortableSeqItem({id, text}: {id: string; text: string}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1}}
      className={styles.seq_item}
    >
      <button type='button' className={styles.drag_handle} {...attributes} {...listeners}>
        <GripVerticalIcon size={13} />
      </button>
      <span>{text}</span>
    </div>
  )
}

export function SequenceStudent({payload, onChange}: {payload: SequencePayload; onChange: (a: StudentAnswer) => void}) {
  const seed = payload.items.length * 13 + (payload.items[0]?.text.charCodeAt(0) ?? 1)
  const [items, setItems] = useState(() => seededShuffle([...payload.items], seed))
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const o = prev.findIndex((i) => i.id === active.id)
      const n = prev.findIndex((i) => i.id === over.id)
      const next = arrayMove(prev, o, n)
      onChange({type: TaskBlockType.SEQUENCE, value: next.map((i) => i.id)})
      return next
    })
  }

  return (
    <div className={styles.block}>
      <p className={styles.instruction}>Перетащи элементы в правильном порядке</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.seq_list}>
            {items.map((item) => (
              <SortableSeqItem key={item.id} id={item.id} text={item.text} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH_PAIRS
// ─────────────────────────────────────────────────────────────────────────────

// Studentviews.tsx — только MatchPairsStudent

export function MatchPairsStudent({
  payload,
  onChange
}: {
  payload: MatchPairsPayload
  onChange: (a: StudentAnswer) => void
}) {
  const [matches, setMatches] = useState<Map<string, string>>(new Map())

  // перемешиваем правые элементы один раз при маунте
  const [rightItems] = useState(() =>
    [...payload.pairs].map((p) => ({id: p.id, content: p.right})).sort(() => Math.random() - 0.5)
  )

  const leftItems = payload.pairs.map((p) => ({id: p.id, content: p.left}))

  const handleMatchesChange = (next: Map<string, string>) => {
    setMatches(next)
    onChange({type: TaskBlockType.MATCH_PAIRS, value: next})
  }

  return (
    <MatchConnector
      gradientId={`student-${payload.pairs[0]?.id ?? 'mp'}`}
      leftItems={leftItems}
      rightItems={rightItems}
      matches={matches}
      onMatchesChange={handleMatchesChange}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT_TEXT
// ─────────────────────────────────────────────────────────────────────────────

export function HighlightTextStudent({
  payload,
  onChange
}: {
  payload: HighlightTextPayload
  onChange: (a: StudentAnswer) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange({type: TaskBlockType.HIGHLIGHT_TEXT, value: [...next]})
      return next
    })
  }

  if (!payload.tokens) return null

  return (
    <div className={styles.block}>
      {payload.instruction && <p className={styles.instruction}>{payload.instruction}</p>}
      <div className={styles.tokens}>
        {payload.tokens.map((token) => {
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
              className={`${styles.token} ${selected.has(token.id) ? styles.token_selected : ''}`}
              onClick={() => toggle(token.id)}
            >
              {token.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WORD_SCRAMBLE
// ─────────────────────────────────────────────────────────────────────────────

function SortableTile({id, label}: {id: string; label: string}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1}}
      className={styles.tile}
      {...attributes}
      {...listeners}
    >
      {label}
    </div>
  )
}

export function WordScrambleStudent({
  payload,
  onChange
}: {
  payload: WordScramblePayload
  onChange: (a: StudentAnswer) => void
}) {
  const source = payload.source ?? ''
  const items = payload.mode === 'letters' ? source.split('') : source.trim().split(/\s+/)
  const seed = source.length * 7 + (source.charCodeAt(0) || 1)

  const [tiles, setTiles] = useState(() => seededShuffle(items, seed).map((label, i) => ({id: `${label}-${i}`, label})))
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    setTiles((prev) => {
      const o = prev.findIndex((t) => t.id === active.id)
      const n = prev.findIndex((t) => t.id === over.id)
      const next = arrayMove(prev, o, n)
      onChange({type: TaskBlockType.WORD_SCRAMBLE, value: next.map((t) => t.label)})
      return next
    })
  }

  if (!source) return null

  return (
    <div className={styles.block}>
      {payload.hint && <p className={styles.hint}>💡 {payload.hint}</p>}
      <p className={styles.instruction}>
        {payload.mode === 'letters' ? 'Собери слово из букв:' : 'Составь предложение из слов:'}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiles.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className={styles.tiles_row}>
            {tiles.map((tile) => (
              <SortableTile key={tile.id} id={tile.id} label={tile.label} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGUE
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_A = '#3b82f6'
const COLOR_B = '#10b981'

function SortableDialogueTile({line, nameA, nameB}: {line: DialogueLine; nameA: string; nameB: string}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: line.id})
  const isB = line.speaker === 'b'
  const color = isB ? COLOR_B : COLOR_A
  const name = isB ? nameB : nameA
  return (
    <div
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1}}
      className={styles.dialogue_tile}
    >
      <button type='button' className={styles.drag_handle} {...attributes} {...listeners}>
        <GripVerticalIcon size={12} />
      </button>
      <div className={styles.tile_stripe} style={{background: color}} />
      <div>
        <span className={styles.tile_author} style={{color}}>
          {name}
        </span>
        <p className={styles.tile_text}>{line.text}</p>
      </div>
    </div>
  )
}

export function DialogueStudent({payload, onChange}: {payload: DialoguePayload; onChange: (a: StudentAnswer) => void}) {
  const seed = payload.lines.length * 17 + (payload.lines[0]?.text.charCodeAt(0) ?? 5)
  const [tiles, setTiles] = useState(() => seededShuffle([...payload.lines], seed))
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}))

  const handleDragEnd = (e: DragEndEvent) => {
    const {active, over} = e
    if (!over || active.id === over.id) return
    setTiles((prev) => {
      const o = prev.findIndex((t) => t.id === active.id)
      const n = prev.findIndex((t) => t.id === over.id)
      const next = arrayMove(prev, o, n)
      onChange({type: TaskBlockType.DIALOGUE, value: next.map((t) => t.id)})
      return next
    })
  }

  return (
    <div className={styles.block}>
      {payload.instruction && <p className={styles.instruction}>{payload.instruction}</p>}
      <p className={styles.hint}>Перетащи реплики в правильном порядке</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tiles.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.seq_list}>
            {tiles.map((line) => (
              <SortableDialogueTile
                key={line.id}
                line={line}
                nameA={payload.speakers.a || 'A'}
                nameB={payload.speakers.b || 'B'}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
