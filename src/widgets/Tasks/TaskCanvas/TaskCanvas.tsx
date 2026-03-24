
import { useTypedSelector } from '@/features/hooks/store/useTypedSelector'
import { DropTaskZone } from '@/shared/ui/Tasks/DropTaskZone/DropTaskZone'
import styles from './TaskCanvas.module.scss'
import BlockEditor from '../BlockEditor/BlockEditor'

export const TaskCanvas = () => {
  const {blocks} = useTypedSelector(state=>state.tasks)

  return (
    <div className={styles.canvas}>
      {blocks.map(block => (
        <BlockEditor key={block.id} block={block} />
      ))}
      <DropTaskZone /> 
    </div>
  )
}