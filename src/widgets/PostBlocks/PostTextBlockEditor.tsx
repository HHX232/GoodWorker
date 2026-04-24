'use client'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import {useActions} from '@/features/hooks/store/useActions'
import {PostTextPayload} from '@/shared/types/Post/Post.type'
import styles from './PostBlockEditors.module.scss'

interface Props {
  blockId: string
  payload: PostTextPayload
}

export function PostTextBlockEditor({blockId, payload}: Props) {
  const {updatePostBlockPayload} = useActions()
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({placeholder: 'Начните писать текст…'})],
    immediatelyRender: false, // ← вот это
    content: payload.content ?? undefined,
    onUpdate({editor}) {
      updatePostBlockPayload({
        id: blockId,
        payload: {content: editor.getJSON()}
      })
    }
  })

  return (
    <div className={styles.text_editor}>
      <EditorContent editor={editor} />
    </div>
  )
}
