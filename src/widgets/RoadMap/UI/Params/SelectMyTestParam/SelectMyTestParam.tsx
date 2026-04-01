import SelectInput from '@/shared/ui/inputs/SelectInput/SelectInput'
import TestPreview from '@/widgets/Tasks/TestPreview/TestPreview'
import styles from './SelectMyTestParam.module.scss'
import {BlockRoadParam} from '@/shared/types/RoadMap/RoadMap.types'

function SelectMyTestParam({
  param,
  value,
  updateNodeParamValue,
  disabled
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
}) {
  console.log('param', param)
  return (
    <div className={styles.wrapper}>
      <SelectInput
        value={value}
        disabled={disabled}
        onChange={(v) => {
          console.log('onChange called', v)
          updateNodeParamValue(v)
        }}
        options={[{label: 'Hello', value: 'hello'}]}
      />
      <div className={styles.paddingBLock}></div>
      {!!value && (
        <TestPreview
          testId='123'
          avatarUrl='https://i.pravatar.cc/88?img=11'
          authorName='Alex Kim'
          title='Advanced JavaScript Fundamentals'
          description='A comprehensive test covering closures...'
          themes={['JS', 'Async', 'Closures']}
          createdAt='2025-01-12'
        />
      )}
    </div>
  )
}

export default SelectMyTestParam
