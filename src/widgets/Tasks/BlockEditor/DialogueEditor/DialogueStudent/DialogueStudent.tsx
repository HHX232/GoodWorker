import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {DialogueLine, DialoguePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVerticalIcon} from 'lucide-react'
import {useState} from 'react'
import styles from './DialogueStudent.module.scss'
import {seededShuffleStudentView} from '@/features/Roadmap/helpers/seededShuffleStudentView'

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
  const [tiles, setTiles] = useState(() => seededShuffleStudentView([...payload.lines], seed))
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
