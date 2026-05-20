'use client'
import {InfoTextPayload} from '@/shared/types/Tasks/TaskPayload.type'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {generateHTML} from '@tiptap/core'
import {BoldIcon, Heading2Icon, Heading3Icon, ItalicIcon, ListIcon, ListOrderedIcon} from 'lucide-react'
import styles from './InfoTextEditor.module.scss'

interface Props {
  payload: InfoTextPayload
  onChange?: (payload: InfoTextPayload) => void
  viewOnly?: boolean
  titleNode?: React.ReactNode
}

// Renders tiptap JSON as static HTML — works server-side and on first paint, no editor mount needed
function InfoTextEditorView({payload, titleNode}: {payload: InfoTextPayload; titleNode?: React.ReactNode}) {
  let html = ''
  try {
    html = generateHTML(payload.content ?? {type: 'doc', content: []}, [StarterKit])
  } catch {
    html = ''
  }
  return (
    <div style={{background: '#fff', borderRadius: 12, padding: '12px 16px'}}>
      {titleNode}
      <div className={styles.editor} dangerouslySetInnerHTML={{__html: html}} />
    </div>
  )
}

function InfoTextEditorEdit({payload, onChange}: {payload: InfoTextPayload; onChange: (p: InfoTextPayload) => void}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions: [StarterKit, Placeholder.configure({placeholder: 'Введите текст материала...'})],
    content: payload.content ?? '',
    onUpdate({editor}) {
      onChange({content: editor.getJSON()})
    }
  })

  if (!editor) return null

  const tools = [
    {icon: <Heading2Icon size={15} />, action: () => editor.chain().focus().toggleHeading({level: 2}).run(), active: editor.isActive('heading', {level: 2}), title: 'Заголовок 2'},
    {icon: <Heading3Icon size={15} />, action: () => editor.chain().focus().toggleHeading({level: 3}).run(), active: editor.isActive('heading', {level: 3}), title: 'Заголовок 3'},
    {icon: <BoldIcon size={15} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Жирный'},
    {icon: <ItalicIcon size={15} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Курсив'},
    {icon: <ListIcon size={15} />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Список'},
    {icon: <ListOrderedIcon size={15} />, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Нумерованный список'},
  ]

  return (
    <div className={styles.box}>
      <div className={styles.toolbar}>
        {tools.map((tool, i) => (
          <button key={i} type='button' title={tool.title} onClick={tool.action}
            className={`${styles.tool_btn} ${tool.active ? styles.tool_btn_active : ''}`}>
            {tool.icon}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className={styles.editor} />
    </div>
  )
}

export const InfoTextEditor = ({payload, onChange, viewOnly = false, titleNode}: Props) => {
  if (viewOnly) {
    return <InfoTextEditorView payload={payload} titleNode={titleNode} />
  }
  return <InfoTextEditorEdit payload={payload} onChange={onChange!} />
}
