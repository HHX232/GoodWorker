'use client'
import { useActions } from '@/features/hooks/store/useActions'
import { ChooseOptionPayload } from '@/shared/types/Tasks/TaskPayload.type'
import { CheckboxUI, RadioUI, TextAreaUI } from '@/shared/ui/inputs'
import { nanoid } from '@reduxjs/toolkit'
import { useTranslations } from 'next-intl'
import styles from './ChooseOptionEditor.module.scss'

interface Props {
  blockId: string
  payload: ChooseOptionPayload
  readonly?: boolean
}

function ChooseOptionEditor({blockId, payload, readonly = false}: Props) {
  const t = useTranslations('TaskEditors')
  const {updateBlockPayload} = useActions()

  const update = (updated: Partial<ChooseOptionPayload>) => {
    updateBlockPayload({id: blockId, payload: {...payload, ...updated}})
  }

  const addOption = () => update({options: [...payload.options, {id: nanoid(), text: ''}]})

  const removeOption = (id: string) => {
    const filtered = payload.options.filter((o) => o.id !== id)
    const correctId = Array.isArray(payload.correctId)
      ? payload.correctId.filter((cId) => cId !== id)
      : payload.correctId === id ? '' : payload.correctId
    update({options: filtered, correctId})
  }

  const updateOptionText = (id: string, text: string) => {
    update({options: payload.options.map((o) => (o.id === id ? {...o, text} : o))})
  }

  const toggleCorrect = (id: string) => {
    if (Array.isArray(payload.correctId)) {
      const already = payload.correctId.includes(id)
      update({correctId: already ? payload.correctId.filter((cId) => cId !== id) : [...payload.correctId, id]})
    } else {
      update({correctId: id})
    }
  }

  const toggleMode = () => {
    const isMulti = Array.isArray(payload.correctId)
    update({correctId: isMulti ? '' : []})
  }

  const isMultiMode = Array.isArray(payload.correctId)
  const isChecked = (id: string) =>
    Array.isArray(payload.correctId) ? payload.correctId.includes(id) : payload.correctId === id

  return (
    <div className={styles.editor_box}>
      {readonly ? <p>{payload.question}</p> : (
        <TextAreaUI
          minRows={1}
          currentValue={payload.question}
          onSetValue={(val) => update({question: val})}
          placeholder={t('questionPlaceholder')}
        />
      )}

      {!readonly && (
        <div className={styles.mode_toggle}>
          <CheckboxUI checked={isMultiMode} label={t('multipleCorrect')} onChange={toggleMode} />
        </div>
      )}

      <div className={styles.options_list}>
        {payload.options.map((option, index) => (
          <div key={option.id} className={styles.option_row}>
            {isMultiMode ? (
              <CheckboxUI
                checked={isChecked(option.id)}
                onChange={() => toggleCorrect(option.id)}
                label={readonly ? `${option.text}` : (
                  <TextAreaUI
                    minRows={1}
                    currentValue={option.text}
                    onSetValue={(val) => updateOptionText(option.id, val)}
                    placeholder={t('optionPlaceholder', {n: index + 1})}
                  />
                )}
              />
            ) : (
              <RadioUI
                checked={isChecked(option.id)}
                value={option.id}
                name={blockId}
                onChange={() => toggleCorrect(option.id)}
                label={readonly ? `${option.text}` : (
                  <TextAreaUI
                    minRows={1}
                    currentValue={option.text}
                    onSetValue={(val) => updateOptionText(option.id, val)}
                    placeholder={t('optionPlaceholder', {n: index + 1})}
                  />
                )}
              />
            )}
            {!readonly && (
              <button type='button' className={styles.remove_btn} onClick={() => removeOption(option.id)}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {!readonly && (
        <button type='button' className={styles.add_btn} onClick={addOption}>
          {t('addOption')}
        </button>
      )}
    </div>
  )
}

export default ChooseOptionEditor
