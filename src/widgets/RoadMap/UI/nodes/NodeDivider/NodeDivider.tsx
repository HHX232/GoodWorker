/* eslint-disable @typescript-eslint/no-explicit-any */
import NodeHeader from '../NodeHeader/NodeHeader'
import styles from './NodeDivider.module.scss'
export function NodeDivider({nodeId, taskType, isSelected}: any) {
  return (
    <div className={`${styles.divider} ${isSelected ? styles.selected : ''}`}>
      <NodeHeader align='vertical' hideTitle taskType={taskType} nodeId={nodeId} />
    </div>
  )
}
