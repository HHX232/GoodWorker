import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {SequencePayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from '@dnd-kit/core'
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVerticalIcon} from 'lucide-react'
import {useState} from 'react'
import styles from './SequenceStudent.module.scss'
import {seededShuffleStudentView} from '@/features/Roadmap/helpers/seededShuffleStudentView'

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
  const [items, setItems] = useState(() => seededShuffleStudentView([...payload.items], seed))
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
