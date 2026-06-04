'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {FreeAnswerPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {TextAreaUI} from '@/shared/ui/inputs'
import {useTranslations} from 'next-intl'
import styles from './FreeAnswerEditor.module.scss'

interface Props {
  blockId: string
  payload: FreeAnswerPayload
  readonly?: boolean
  error?: string | null
}

function FreeAnswerEditor({blockId, payload, readonly = false, error}: Props) {
  const t = useTranslations('TaskEditors')
  const {updateBlockPayload} = useActions()

  const update = (updated: Partial<FreeAnswerPayload>) => {
    updateBlockPayload({id: blockId, payload: {...payload, ...updated}})
  }

  return (
    <div className={`${styles.editor_box} ${error ? styles.editor_error : ''}`}>
      <div className={styles.field}>
        <span className={styles.label}>{t('questionLabel')}</span>
        <TextAreaUI
          minRows={1}
          currentValue={payload.question}
          onSetValue={(val) => update({question: val})}
          placeholder={t('questionPlaceholder')}
          disabled={readonly}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          {t('referenceAnswer')} <span className={styles.hint}>{t('referenceAnswerHint')}</span>
        </span>
        <TextAreaUI
          minRows={2}
          currentValue={payload.referenceAnswer ?? ''}
          onSetValue={(val) => update({referenceAnswer: val})}
          placeholder={t('referenceAnswerPlaceholder')}
          disabled={readonly}
        />
      </div>
    </div>
  )
}

export default FreeAnswerEditor
