/* eslint-disable react-hooks/refs */
// features/test-block-editor/ui/editors/FillText/FillTextEditor.tsx
'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {StudentAnswer} from '@/features/Tasks/TaskResult/scoreBlock'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'
import {InputTaskGapNode} from '@/shared/ui/inputs/InputTaskGapComponent/InputGapNode'
import {SelectTaskGapNode} from '@/shared/ui/inputs/SelectGapNode/SelectGapNode'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {useTranslations} from 'next-intl'
import {useCallback, useRef} from 'react'
import styles from './FillTextEditor.module.scss'

interface Props {
  blockId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: {content: any} // tiptap JSON
  onlyPass?: boolean
  error?: string | null
  onChangeAnswer?: (answer: StudentAnswer & {type: TaskBlockType.FILL_TEXT}) => void
}

export const FillTextEditor = ({blockId, payload, onlyPass = false, onChangeAnswer, error}: Props) => {
  const t = useTranslations('TaskEditors')
  const {updateBlockPayload} = useActions()

  const answersRef = useRef<Record<string, string>>({})

  const handleGapChange = useCallback(
    (gapId: string, value: string) => {
      answersRef.current = {...answersRef.current, [gapId]: value}
      onChangeAnswer?.({
        type: TaskBlockType.FILL_TEXT,
        value: answersRef.current
      })
    },
    [onChangeAnswer]
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: !onlyPass,
    extensions: [
      StarterKit,
      ...(!onlyPass ? [Placeholder.configure({placeholder: t('fillTextPlaceholder')})] : []),
      InputTaskGapNode.configure(onlyPass ? {onChangeAnswer: handleGapChange} : {}),
      SelectTaskGapNode.configure(onlyPass ? {onChangeAnswer: handleGapChange} : {})
    ],
    content: payload.content ?? '',
    onUpdate({editor}) {
      if (onlyPass) return
      updateBlockPayload({id: blockId, payload: {content: editor.getJSON()}})
    }
  })

  const insertGap = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({type: 'inputGap', attrs: {answer: ''}})
      .run()
  }

  const insertSelectGap = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({type: 'selectGap', attrs: {options: []}})
      .run()
  }

  return (
    <div className={`${styles.editor_box}  ${error ? styles.editor_error : ''}`}>
      {!onlyPass && (
        <div className={styles.toolbar}>
          <button type='button' onClick={insertGap} className={styles.toolbar_btn}>
            {t('addGap')}
          </button>
          <button type='button' onClick={insertSelectGap} className={styles.toolbar_btn}>
            + Выбрать вариант
          </button>
        </div>
      )}
      <EditorContent editor={editor} className={styles.editor_content} data-pass={onlyPass ? 'true' : undefined} />
    </div>
  )
}
