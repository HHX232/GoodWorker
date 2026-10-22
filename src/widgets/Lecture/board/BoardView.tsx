'use client'

import { boardSummary, parseBoardSpec } from '@/shared/lib/lecture/boardSpec'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Loader2Icon, Maximize2Icon, Move3dIcon, PresentationIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { lectureCtx, photoUrl, uploadPhoto } from '../editor/photoTools'
import { BoardEditorDialog } from './BoardEditorDialog'
import { buildSceneFromSpec, EMPTY_SCENE, sceneHasContent, type BoardScene } from './boardScene'
import { snapshotBoard } from './boardSnapshot'

/** Who's editing — set by the workspace; the board's own AI formula tools are VIP/admin. */
export const boardAccess: { isVip: boolean; isAdmin: boolean } = { isVip: false, isAdmin: false }

type BoardSize = 's' | 'm' | 'l'
const SIZES: BoardSize[] = ['s', 'm', 'l']
const WIDTH: Record<BoardSize, string> = { s: '50%', m: '75%', l: '100%' }
const LIVE_HEIGHT: Record<BoardSize, number> = { s: 420, m: 480, l: 560 }

/**
 * A whiteboard block between paragraphs. At rest it shows the board's
 * snapshot (a LecturePhoto — what the page, PDF and Word show); «Крутить
 * здесь» (or a click on the picture) turns it into the live call board right
 * in the notes — figures move and rotate in place — and «Готово» saves the
 * scene (JSON, for future edits) and a fresh snapshot. «На весь экран» opens
 * the same board over the page. S/M/L sets how wide the block sits. A block
 * the AI created from a spec builds its scene and first snapshot by itself.
 */
export function BoardView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useTranslations('lecture')
  const { scene, photoId, width, height, spec } = node.attrs as { scene: BoardScene | null; photoId: string; width: number; height: number; spec: unknown }
  const size = (SIZES.includes(node.attrs.size) ? node.attrs.size : 'l') as BoardSize
  const [mode, setMode] = useState<null | 'live' | 'full'>(null)
  // «На весь экран» from the live board carries its unsaved state along.
  const [handoff, setHandoff] = useState<BoardScene | null>(null)
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
    setMode(null)
    setHandoff(null)
  }

  const editable = editor.isEditable
  const live = mode === 'live'
  const wrapRef = useRef<HTMLDivElement>(null)

  // TipTap marks the whole block `draggable` (drag it between paragraphs). With the live
  // board inside, dragging a figure would start a native drag of the block and scroll the
  // page — so while it's live the block isn't draggable and a stray dragstart is dropped.
  useEffect(() => {
    const outer = wrapRef.current?.closest('.react-renderer') as HTMLElement | null
    if (!outer || !live) return
    const was = outer.getAttribute('draggable')
    outer.setAttribute('draggable', 'false')
    const stop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    outer.addEventListener('dragstart', stop, true)
    return () => {
      outer.removeEventListener('dragstart', stop, true)
      if (was !== null) outer.setAttribute('draggable', was)
    }
  }, [live])

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`lecture-board ${selected ? 'is-selected' : ''} ${live ? 'is-live' : ''}`}
      style={{ width: live ? '100%' : WIDTH[size] }}
      data-size={size}
    >
      <div className="lecture-board-head" contentEditable={false} data-drag-handle>
        <span className="lecture-board-tag"><PresentationIcon size={13} /> {t('board')}</span>
        {editable && !live && (
          <>
            <div className="lecture-board-sizes" role="group" aria-label={t('boardSize')}>
              {SIZES.map(v => (
                <button key={v} type="button" className={v === size ? 'is-on' : ''} aria-pressed={v === size} onClick={() => updateAttributes({ size: v })} title={t(`boardSize_${v}`)}>{v.toUpperCase()}</button>
              ))}
            </div>
            <button type="button" className="lecture-board-open" onClick={() => setMode('live')} disabled={busy}><Move3dIcon size={13} /> <span>{t('boardLive')}</span></button>
            <button type="button" className="lecture-board-icon" onClick={() => setMode('full')} disabled={busy} aria-label={t('boardFullscreen')} title={t('boardFullscreen')}><Maximize2Icon size={14} /></button>
            <button type="button" className="lecture-board-del" onClick={() => deleteNode()} aria-label={t('delete')} title={t('delete')}><Trash2Icon size={14} /></button>
          </>
        )}
      </div>

      {live ? (
        <div contentEditable={false}>
          <BoardEditorDialog
            initial={scene ?? EMPTY_SCENE}
            isVip={boardAccess.isVip}
            isAdmin={boardAccess.isAdmin}
            saving={busy}
            onDone={done}
            onCancel={() => setMode(null)}
            inline={{ height: LIVE_HEIGHT[size], onExpand: current => { setHandoff(current); setMode('full') } }}
          />
        </div>
      ) : (
        <div className="lecture-board-body" contentEditable={false} onClick={() => editable && !busy && setMode('live')} title={editable ? t('boardLiveHint') : undefined}>
          {photoId
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl(lectureId, photoId)} alt="" width={width} height={height} draggable={false} />
            : <div className="lecture-board-empty">
                {!editable && parseBoardSpec(spec)
                  ? boardSummary(parseBoardSpec(spec))
                  : busy || parseBoardSpec(spec) ? <><Loader2Icon size={18} className="lecture-spin" /> {t('boardBuilding')}</> : t('boardEmpty')}
              </div>}
          {busy && photoId && <span className="lecture-board-busy"><Loader2Icon size={18} className="lecture-spin" /></span>}
        </div>
      )}

      {mode === 'full' && (
        <BoardEditorDialog
          initial={handoff ?? scene ?? EMPTY_SCENE}
          isVip={boardAccess.isVip}
          isAdmin={boardAccess.isAdmin}
          saving={busy}
          // A hand-off from the live board counts as changed even if the full screen adds nothing.
          onDone={(next, changed) => done(next, changed || !!handoff)}
          onCancel={() => { setMode(null); setHandoff(null) }}
        />
      )}
    </NodeViewWrapper>
  )
}
