'use client'

import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '@/shared/lib/lecture/markdownToDoc'
import type { Editor, JSONContent } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import {
  CameraIcon, CopyIcon, EraserIcon, ImagePlusIcon, ListIcon, MessageSquarePlusIcon, MinimizeIcon, SigmaIcon, SparklesIcon, SpellCheckIcon, WandSparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AskAiPanel, type AskTarget } from './AskAiPanel'
import { docText, fragmentFor, markRange } from './docOps'
import { AiSection, BoardBlockNode, GraphBlockNode, LectureNoteMark, LecturePhotoNode, MathBlock, MathInline, PendingFixMark } from './extensions'
import { InsertPhotoDialog } from './InsertPhotoDialog'
import { afterBlock, lectureCtx } from './photoTools'
import { FormulaDialog } from './FormulaDialog'
import { mathEditBus, type MathEditRequest } from './MathView'
import styles from './LectureEditor.module.scss'

interface Props {
  lectureId: string
  initialDoc: JSONContent | null
  editable: boolean
  /** Ask AI / photo fix / formula AI need VIP; plain editing doesn't. */
  canUseAi: boolean
  onReady: (editor: Editor) => void
  onChange: (doc: JSONContent) => void
}

function MenuItem({ icon, label, onClick, ai }: { icon: React.ReactNode; label: string; onClick: () => void; ai?: boolean }) {
  return (
    <button type="button" className={`${styles.menuItem} ${ai ? styles.menuItemAi : ''}`} onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  )
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * The lecture document ("свой Word"). Selecting text opens an actions menu
 * (Scribe-style): ask AI (side-by-side suggestion, applied only on
 * confirm), quick AI rewrites, note, formula, fix by a board photo (runs in
 * the background while recording continues), copy, colours. Every async AI
 * edit tracks its target with a temporary mark, so text typed elsewhere
 * meanwhile doesn't shift where the answer lands.
 */
export function LectureEditor({ lectureId, initialDoc, editable, canUseAi, onReady, onChange }: Props) {
  const t = useTranslations('lecture')
  const [formula, setFormula] = useState<MathEditRequest | null>(null)
  const [noteDraft, setNoteDraft] = useState<{ id: string | null; text: string; quote: string } | null>(null)
  const [ask, setAsk] = useState<AskTarget | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const insertInput = useRef<HTMLInputElement>(null)
  const insertAt = useRef(0)
  const [insertPhoto, setInsertPhoto] = useState<{ file: File; at: number } | null>(null)
  const pendingPhoto = useRef<{ id: string; selection: string; context: string } | null>(null)

  // Photo node views read the lecture id from here (they render outside these props).
  useLayoutEffect(() => { lectureCtx.id = lectureId }, [lectureId])

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      MathInline,
      MathBlock,
      LecturePhotoNode,
      BoardBlockNode,
      GraphBlockNode,
      AiSection,
      LectureNoteMark,
      PendingFixMark,
      Placeholder.configure({ placeholder: t('editorPlaceholder') }),
    ],
    content: initialDoc ?? '',
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      handleClickOn: (_view, _pos, _node, _nodePos, event) => {
        const el = (event.target as HTMLElement).closest?.('[data-note-id]') as HTMLElement | null
        if (el?.dataset.noteId && editor) {
          const range = markRange(editor.state.doc, 'lectureNote', el.dataset.noteId)
          if (range) {
            editor.commands.setTextSelection(range)
            setNoteDraft({ id: el.dataset.noteId, text: el.dataset.note ?? '', quote: editor.state.doc.textBetween(range.from, range.to, ' ') })
          }
        }
        return false
      },
    },
  })

  useEffect(() => { if (editor) onReady(editor) }, [editor, onReady])
  useEffect(() => { editor?.setEditable(editable) }, [editor, editable])

  useEffect(() => {
    mathEditBus.open = req => {
      if (req.ai && !canUseAi) { toast.error(t('vipOnly')); return }
      setFormula(req)
    }
    return () => { mathEditBus.open = undefined }
  }, [canUseAi, t])

  const clearMark = useCallback((name: 'pendingFix', id: string) => {
    if (!editor) return
    const r = markRange(editor.state.doc, name, id)
    if (r) editor.chain().setTextSelection(r).unsetMark(name).setTextSelection(r.to).run()
  }, [editor])

  // Closing the camera/file picker without a photo must drop the pending mark.
  useEffect(() => {
    const input = photoInput.current
    if (!input) return
    const onCancel = () => { const job = pendingPhoto.current; pendingPhoto.current = null; if (job) clearMark('pendingFix', job.id) }
    input.addEventListener('cancel', onCancel)
    return () => input.removeEventListener('cancel', onCancel)
  }, [clearMark, editor])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? { noteId: (e.getAttributes('lectureNote').id as string | undefined) ?? null } : null,
  })

  if (!editor) return <div className={styles.skeleton} aria-busy="true" />

  const selectionText = () => {
    const { from, to } = editor.state.selection
    return docText(editor.state.doc, from, to)
  }

  /** Marks the selection as an AI target and returns its id + text + context. */
  const markSelection = () => {
    const { from, to } = editor.state.selection
    const id = newId()
    const selection = selectionText()
    const context = docText(editor.state.doc, from - 1500, to + 1000)
    editor.chain().setMark('pendingFix', { id }).setTextSelection(to).run()
    return { id, selection, context }
  }

  const openAsk = (preset?: string) => {
    if (!canUseAi) { toast.error(t('vipOnly')); return }
    const sel = window.getSelection()
    const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null
    const { id, selection, context } = markSelection()
    setAsk({ id, selection, context, preset, rect: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : { top: 120, bottom: 140, left: 40, right: 400 } })
  }

  const applyAsk = (blocks: JSONContent[]) => {
    if (!ask) return
    const range = markRange(editor.state.doc, 'pendingFix', ask.id)
    if (range) editor.chain().focus().insertContentAt(range, fragmentFor(blocks)).run()
    else toast.message(t('photoTargetGone'))
    setAsk(null)
  }

  const cancelAsk = () => {
    if (ask) clearMark('pendingFix', ask.id)
    setAsk(null)
  }

  const toFormula = () => {
    const { from, to } = editor.state.selection
    const seed = editor.state.doc.textBetween(from, to, ' ')
    setFormula({ latex: seed, apply: latex => { if (latex) editor.chain().focus().insertContentAt({ from, to }, { type: 'mathInline', attrs: { latex } }).run() } })
  }

  const openNote = () => {
    const attrs = editor.getAttributes('lectureNote')
    setNoteDraft({ id: (attrs.id as string) ?? null, text: (attrs.text as string) ?? '', quote: selectionText() })
  }

  const saveNote = () => {
    if (!noteDraft) return
    const text = noteDraft.text.trim()
    const chain = editor.chain().focus().extendMarkRange('lectureNote')
    if (!text) chain.unsetMark('lectureNote').run()
    else chain.setMark('lectureNote', { id: noteDraft.id ?? newId(), text, createdAt: new Date().toISOString() }).run()
    setNoteDraft(null)
  }

  const startPhotoFix = () => {
    if (!canUseAi) { toast.error(t('vipOnly')); return }
    pendingPhoto.current = markSelection()
    photoInput.current?.click()
  }

  const startInsertPhoto = () => {
    if (!canUseAi) { toast.error(t('vipOnly')); return }
    insertAt.current = afterBlock(editor, editor.state.selection.to)
    insertInput.current?.click()
  }

  const onPhoto = async (file: File | undefined) => {
    const job = pendingPhoto.current
    pendingPhoto.current = null
    if (!job) return
    if (!file) { clearMark('pendingFix', job.id); return }
    const toastId = toast.loading(t('photoWorking'))
    try {
      const photo = file.size > 2.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type) ? await compressImageForUpload(file, 2200, 2200, 0.85) : file
      const form = new FormData()
      form.append('photo', photo)
      form.append('selection', job.selection)
      form.append('context', job.context)
      const res = await fetch(`/api/lecture/${lectureId}/photo-fix`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? String(res.status))
      const range = markRange(editor.state.doc, 'pendingFix', job.id)
      if (!range) { toast.message(t('photoTargetGone'), { id: toastId }); return }
      if (!(data.blocks as JSONContent[])?.length) { clearMark('pendingFix', job.id); toast.message(t('photoNothing'), { id: toastId }); return }
      editor.chain().insertContentAt(range, fragmentFor(data.blocks), { updateSelection: false }).run()
      toast.success(t('photoDone'), { id: toastId })
    } catch (e) {
      clearMark('pendingFix', job.id)
      toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : t('photoFailed'), { id: toastId })
    }
  }

  return (
    <div className={styles.wrap}>
      {editable && (
        <BubbleMenu
          editor={editor}
          className={styles.menu}
          options={{
            placement: 'bottom-start',
            offset: 8,
            flip: true,
            shift: { padding: 8 },
            // Never taller than the room left on screen — the menu scrolls inside instead.
            size: { padding: 8, apply: ({ availableHeight, elements }) => { elements.floating.style.maxHeight = `${Math.max(180, Math.min(520, availableHeight))}px` } },
          }}
          shouldShow={({ editor: e, state: s }) => !s.selection.empty && e.isEditable && !ask && !e.isActive('mathInline') && !e.isActive('mathBlock') && !e.isActive('lecturePhoto') && !e.isActive('boardBlock')}
        >
          <div className={styles.menuSection}>{t('menuActions')}</div>
          <MenuItem icon={<SparklesIcon size={15} />} label={t('askTitle')} onClick={() => openAsk()} ai />
          <MenuItem icon={<ImagePlusIcon size={15} />} label={t('insertFromPhoto')} onClick={() => startInsertPhoto()} ai />
          <MenuItem icon={<CameraIcon size={15} />} label={t('photoFix')} onClick={() => startPhotoFix()} ai />
          <MenuItem icon={<MessageSquarePlusIcon size={15} />} label={state?.noteId ? t('noteEdit') : t('noteAdd')} onClick={openNote} />
          <MenuItem icon={<SigmaIcon size={15} />} label={t('toFormula')} onClick={toFormula} />
          <MenuItem icon={<CopyIcon size={15} />} label={t('copy')} onClick={() => { navigator.clipboard?.writeText(selectionText()).then(() => toast.success(t('copied'))).catch(() => {}) }} />

          <div className={styles.menuSection}>{t('menuRewrite')} <span className={styles.aiTag}>AI</span></div>
          <MenuItem icon={<SpellCheckIcon size={15} />} label={t('askChipFix')} onClick={() => openAsk(t('askChipFix'))} />
          <MenuItem icon={<MinimizeIcon size={15} />} label={t('askChipShorter')} onClick={() => openAsk(t('askChipShorter'))} />
          <MenuItem icon={<WandSparklesIcon size={15} />} label={t('askChipFormulas')} onClick={() => openAsk(t('askChipFormulas'))} />
          <MenuItem icon={<ListIcon size={15} />} label={t('askChipList')} onClick={() => openAsk(t('askChipList'))} />

          <div className={styles.menuSection}>{t('menuStyle')}</div>
          <div className={styles.swatchRow}>
            {Object.entries(TEXT_COLORS).map(([name, hex]) => (
              <button key={name} type="button" className={`${styles.swatch} ${styles.swatchText}`} style={{ color: hex }} aria-label={`${t('textColor')}: ${name}`} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().setColor(hex).run()}>A</button>
            ))}
          </div>
          <div className={styles.swatchRow}>
            {Object.entries(HIGHLIGHT_COLORS).map(([name, hex]) => (
              <button key={name} type="button" className={styles.swatch} style={{ background: hex }} aria-label={`${t('highlight')}: ${name}`} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().setHighlight({ color: hex }).run()} />
            ))}
            <button type="button" className={styles.swatchClear} aria-label={t('clearStyle')} title={t('clearStyle')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().unsetColor().unsetHighlight().run()}><EraserIcon size={13} /></button>
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className={styles.editor} />

      <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={insertInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setInsertPhoto({ file: f, at: insertAt.current }); e.target.value = '' }} />
      {insertPhoto && <InsertPhotoDialog lectureId={lectureId} editor={editor} file={insertPhoto.file} at={insertPhoto.at} onClose={() => setInsertPhoto(null)} />}

      {ask && <AskAiPanel lectureId={lectureId} target={ask} onApply={applyAsk} onCancel={cancelAsk} />}

      {noteDraft && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) setNoteDraft(null) }}>
          <div className={styles.dialog} role="dialog" aria-label={t('noteTitle')}>
            <div className={styles.dialogTitle}>{t('noteTitle')}</div>
            {noteDraft.quote && <p className={styles.dialogQuote}>{noteDraft.quote.slice(0, 240)}</p>}
            <textarea className={styles.noteInput} value={noteDraft.text} autoFocus rows={4} maxLength={2000} placeholder={t('notePlaceholder')} onChange={e => setNoteDraft(d => d && { ...d, text: e.target.value })} />
            <div className={styles.dialogActions}>
              {noteDraft.id && <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => { editor.chain().focus().extendMarkRange('lectureNote').unsetMark('lectureNote').run(); setNoteDraft(null) }}>{t('noteDelete')}</button>}
              <span className={styles.spacer} />
              <button type="button" className={styles.btn} onClick={() => setNoteDraft(null)}>{t('cancel')}</button>
              <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={saveNote}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {formula && (
        <FormulaDialog
          lectureId={lectureId}
          canUseAi={canUseAi}
          initial={formula.latex}
          startWithAi={formula.ai}
          context={docText(editor.state.doc, editor.state.selection.from - 1200, editor.state.selection.to + 600)}
          onApply={formula.apply}
          onClose={() => setFormula(null)}
        />
      )}
    </div>
  )
}
