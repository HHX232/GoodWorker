// features/test-block-editor/ui/editors/FillText/FillTextEditor.tsx
'use client'
import { useActions } from '@/features/hooks/store/useActions'
import { InputTaskGapNode } from '@/shared/ui/inputs/InputTaskGapComponent/InputGapNode'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import styles from './FillTextEditor.module.scss'
import { SelectTaskGapNode } from '@/shared/ui/inputs/SelectGapNode/SelectGapNode'

interface Props {
  blockId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { content: any } // tiptap JSON
}

export const FillTextEditor = ({ blockId, payload }: Props) => {
  const { updateBlockPayload } = useActions()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Введите текст задания...' }),
      InputTaskGapNode,
      SelectTaskGapNode,
    ],
    content: payload.content ?? '',
    onUpdate({ editor }) {
      updateBlockPayload({
        id: blockId,
        payload: { content: editor.getJSON() },
      })
    },
  })

  const insertGap = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'inputGap', attrs: { answer: '' } })
      .run()
  }

  const insertSelectGap = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'selectGap', attrs: { options: [] } })
      .run()
  }

  return (
    <div className={styles.editor_box}>
      <div className={styles.toolbar}>
        <button type="button" onClick={insertGap} className={styles.toolbar_btn}>
          + Добавить пропуск
        </button>
        <button
          type="button"
          onClick={insertSelectGap}
          className={styles.toolbar_btn}
        >
          + Выбрать вариант
        </button>
      </div>
      <EditorContent editor={editor} className={styles.editor_content} />
    </div>
  )
}