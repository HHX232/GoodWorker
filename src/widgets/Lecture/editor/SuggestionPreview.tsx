'use client'

import type { JSONContent } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { MathBlock, MathInline } from './extensions'

/** Read-only render of AI blocks with the real editor schema — formulas and colours look exactly as they will once applied. */
export function SuggestionPreview({ blocks, className }: { blocks: JSONContent[]; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit.configure({ link: false }), TextStyle, Color, Highlight.configure({ multicolor: true }), MathInline, MathBlock],
    content: { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] },
  })
  useEffect(() => {
    editor?.commands.setContent({ type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] })
  }, [editor, blocks])
  return <EditorContent editor={editor} className={className} />
}
