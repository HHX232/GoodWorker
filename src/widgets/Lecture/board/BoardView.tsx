'use client'

import { boardSummary, parseBoardSpec } from '@/shared/lib/lecture/boardSpec'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Loader2Icon, PresentationIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { lectureCtx, photoUrl, uploadPhoto } from '../editor/photoTools'
import { BoardEditorDialog } from './BoardEditorDialog'
import { buildSceneFromSpec, EMPTY_SCENE, sceneHasContent, type BoardScene } from './boardScene'
import { snapshotBoard } from './boardSnapshot'

/** Who's editing — set by the workspace; the board's own AI formula tools are VIP/admin. */
export const boardAccess: { isVip: boolean; isAdmin: boolean } = { isVip: false, isAdmin: false }

/**
 * A whiteboard block between paragraphs: shows the board's snapshot; "Открыть
 * доску" opens the full call whiteboard on this block's scene. The scene
 * (JSON) is kept for future edits, the snapshot (PNG, a LecturePhoto) is what
 * the page, PDF and Word show. A block the AI created from a spec builds its
 * scene and first snapshot by itself on first render.
 */
export function BoardView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useTranslations('lecture')
  const { scene, photoId, width, height, spec } = node.attrs as { scene: BoardScene | null; photoId: string; width: number; height: number; spec: unknown }
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const building = useRef(false)
  const lectureId = lectureCtx.id

  const save = async (next: BoardScene) => {
    setBusy(true)
    try {
      const shot = await snapshotBoard(next)
      if (!shot) { updateAttributes({ scene: next, photoId: '', width: 0, height: 0, spec: null }); return }
      const id = await uploadPhoto(lectureId, { file: new File([shot.blob], 'board.png', { type: 'image/png' }), width: shot.width, height: shot.height, cropped: false })
      updateAttributes({ scene: next, photoId: id, width: shot.width, height: shot.height, spec: null })
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'QUOTA_EXCEEDED' ? t('quotaExceeded') : t('boardSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  // An AI-made block arrives with just a spec — turn it into a real scene once.
  useEffect(() => {
    const parsed = parseBoardSpec(spec)
    if (!parsed || sceneHasContent(scene) || building.current || !editor.isEditable) return
    building.current = true
    buildSceneFromSpec(parsed).then(save).catch(() => toast.error(t('boardSaveFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec])

  const done = async (next: BoardScene, changed: boolean) => {
    if (changed) await save(next)
    setOpen(false)
  }

  return (
    <NodeViewWrapper className={`lecture-board ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <div className="lecture-board-head" contentEditable={false}>
        <span className="lecture-board-tag"><PresentationIcon size={13} /> {t('board')}</span>
        {editor.isEditable && (
          <>
            <button type="button" className="lecture-board-open" onClick={() => setOpen(true)} disabled={busy}>{t('boardOpen')}</button>
            <button type="button" className="lecture-board-del" onClick={() => deleteNode()} aria-label={t('delete')} title={t('delete')}><Trash2Icon size={14} /></button>
          </>
        )}
      </div>
      <div className="lecture-board-body" contentEditable={false} onDoubleClick={() => editor.isEditable && setOpen(true)}>
        {photoId
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photoUrl(lectureId, photoId)} alt="" width={width} height={height} draggable={false} />
          : <div className="lecture-board-empty">
              {!editor.isEditable && parseBoardSpec(spec)
                ? boardSummary(parseBoardSpec(spec))
                : busy || parseBoardSpec(spec) ? <><Loader2Icon size={18} className="lecture-spin" /> {t('boardBuilding')}</> : t('boardEmpty')}
            </div>}
        {busy && photoId && <span className="lecture-board-busy"><Loader2Icon size={18} className="lecture-spin" /></span>}
      </div>
      {open && (
        <BoardEditorDialog
          initial={scene ?? EMPTY_SCENE}
          isVip={boardAccess.isVip}
          isAdmin={boardAccess.isAdmin}
          saving={busy}
          onDone={done}
          onCancel={() => setOpen(false)}
        />
      )}
    </NodeViewWrapper>
  )
}
