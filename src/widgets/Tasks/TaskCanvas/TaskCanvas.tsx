
import { useTypedSelector } from '@/features/hooks/store/useTypedSelector'
import { DropTaskZone } from '@/shared/ui/Tasks/DropTaskZone/DropTaskZone'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import styles from './TaskCanvas.module.scss'
import BlockEditor from '../BlockEditor/BlockEditor'

// Sortable reordering piggybacks on the palette's existing DndContext
// (app/(test)/create-test/CreateTestDndWrapper.tsx) — this only adds the
// sortable semantics, it doesn't own a DndContext of its own.
export const TaskCanvas = () => {
  const {blocks} = useTypedSelector(state=>state.tasks)

  return (
    <div className={styles.canvas} id="test-canvas">
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map(block => (
          <BlockEditor key={block.id} block={block} />
        ))}
      </SortableContext>
      <DropTaskZone />
    </div>
  )
}