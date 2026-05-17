import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {WordScramblePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors} from '@dnd-kit/core'
import {SortableContext, arrayMove, horizontalListSortingStrategy, useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {LightbulbIcon} from 'lucide-react'
import {useState} from 'react'
import styles from './WordScrambleStudent.module.scss'
import {seededShuffleStudentView} from '@/features/Roadmap/helpers/seededShuffleStudentView'
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

  const [tiles, setTiles] = useState(() =>
    seededShuffleStudentView(items, seed).map((label, i) => ({id: `${label}-${i}`, label}))
  )
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
      {payload.hint && <p className={styles.hint}><LightbulbIcon size={14} /> {payload.hint}</p>}
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
