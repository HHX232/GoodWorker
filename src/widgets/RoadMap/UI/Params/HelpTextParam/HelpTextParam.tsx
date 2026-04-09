import {BlockRoadParam} from '@/shared/types/RoadMap/RoadMap.types'
import {TextAreaUI} from '@/shared/ui/inputs'
import styles from './HelpTextParam.module.scss'
function HelpTextParam({
  param,
  value,
  updateNodeParamValue,
  disabled,
  t
}: {
  param: BlockRoadParam
  value: string
  updateNodeParamValue: (v: string) => void
  disabled?: boolean
  t: (v: string) => void
}) {
  return (
    <div className={styles.wrapper}>
      <TextAreaUI
        disabled={disabled}
        currentValue={value}
        placeholder={t(param.helpText || '') ?? 'write text'}
        autoResize
        maxRows={disabled ? 30 : 15}
        minRows={0}
        onSetValue={(v) => {
          updateNodeParamValue(v)
        }}
      />
    </div>
  )
}

export default HelpTextParam
