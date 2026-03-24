// features/test-block-editor/ui/editors/InfoTextEditor/InfoTextEditor.tsx
'use client'
import { useActions } from '@/features/hooks/store/useActions'
import { InfoTextPayload } from '@/shared/types/Tasks/TaskPayload.type'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Heading2Icon,
  Heading3Icon,
} from 'lucide-react'
import styles from './InfoTextEditor.module.scss'

interface Props {
  blockId: string
  payload: InfoTextPayload
}

export const InfoTextEditor = ({ blockId, payload }: Props) => {
  const { updateBlockPayload } = useActions()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Введите текст материала...' }),
    ],
    content: payload.content ?? '',
    onUpdate({ editor }) {
      updateBlockPayload({ id: blockId, payload: { content: editor.getJSON() } })
    },
  })

  if (!editor) return null

  const tools = [
    {
      icon: <Heading2Icon size={15} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
      title: 'Заголовок 2',
    },
    {
      icon: <Heading3Icon size={15} />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive('heading', { level: 3 }),
      title: 'Заголовок 3',
    },
    {
      icon: <BoldIcon size={15} />,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
      title: 'Жирный',
    },
    {
      icon: <ItalicIcon size={15} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
      title: 'Курсив',
    },
    {
      icon: <ListIcon size={15} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      title: 'Список',
    },
    {
      icon: <ListOrderedIcon size={15} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      title: 'Нумерованный список',
    },
  ]

  return (
    <div className={styles.box}>
      <div className={styles.toolbar}>
        {tools.map((tool, i) => (
          <button
            key={i}
            type="button"
            title={tool.title}
            onClick={tool.action}
            className={`${styles.tool_btn} ${tool.active ? styles.tool_btn_active : ''}`}
          >
            {tool.icon}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className={styles.editor} />
    </div>
  )
}