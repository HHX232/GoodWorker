'use client'

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import { CheckIcon, Loader2Icon, Maximize2Icon, PresentationIcon, XIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoardScene } from './boardScene'
import styles from './Board.module.scss'

// The call's whiteboard itself — every tool it has in a call (3D figures
// with rotation, edge colours and labels, angle marks, construction lines,
// formulas, templates, grid) is available here, nothing re-implemented.
const CallWhiteboard = dynamic(() => import('@/widgets/VideoRoom/CallWhiteboard/CallWhiteboard').then(m => m.CallWhiteboard), { ssr: false })

interface Props {
  initial: BoardScene
  isVip: boolean
  isAdmin: boolean
  saving: boolean
  /** `changed` false → nothing to save, just close. */
  onDone: (scene: BoardScene, changed: boolean) => void
  onCancel: () => void
  /** Inline: the board lives right in the notes (fixed height), not over the page. */
  inline?: { height: number; onExpand: (scene: BoardScene) => void }
}

function fingerprint(elements: readonly ExcalidrawElement[]): string {
  return elements.filter(e => !e.isDeleted).map(e => `${e.id}:${e.version}`).sort().join('|')
}

/**
 * A lecture board block's editor: full screen over the page, or `inline` —
 * the live board right inside the notes, where a figure can be dragged and
 * turned in place. Same board, same save.
 */
export function BoardEditorDialog({ initial, isVip, isAdmin, saving, onDone, onCancel, inline }: Props) {
  const t = useTranslations('lecture')
  // A private deep copy: Excalidraw mutates elements in place, and these
  // came straight out of the document node's attrs.
  const [start] = useState<BoardScene>(() => structuredClone(initial) as BoardScene)
  const scene = useRef<BoardScene>(start)
  const startPrint = useRef(fingerprint(start.elements))

  // The board reports every change the same way it broadcasts to call
  // participants — here it just lands in this dialog's copy of the scene.
  const readLive = useRef<null | (() => BoardScene)>(null)
  const onSceneApi = useCallback((read: () => BoardScene) => { readLive.current = read }, [])

  // The live scene, not the last broadcast: zone rotations/recolors land via mutateElement.
  const current = (): BoardScene => {
    const live = readLive.current?.()
    return live ? { elements: [...live.elements], files: { ...scene.current.files, ...live.files } } : scene.current
  }
  const finish = () => {
    const next = current()
    onDone(next, fingerprint(next.elements) !== startPrint.current)
  }

  const onBroadcast = useCallback((elements: readonly ExcalidrawElement[], files: BinaryFiles) => {
    scene.current = { elements: [...elements], files: { ...scene.current.files, ...files } }
  }, [])

  useEffect(() => {
    if (inline) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [inline])

  const board = <CallWhiteboard remoteElements={null} remoteFiles={null} initialScene={start} onBroadcast={onBroadcast} onSceneApi={onSceneApi} isVip={isVip} isAdmin={isAdmin} hideTemplates={!!inline} />

  if (inline) {
    return (
      // Native drag would pick up the whole block when a figure is dragged — the board handles its own pointer moves.
      <div className={`lecture-board-live ${styles.inline}`} onDragStart={e => { e.preventDefault(); e.stopPropagation() }}>
        <div className={styles.inlineBar}>
          <span className={styles.inlineHint}>{t('boardLiveHint')}</span>
          <span className={styles.spacer} />
          <button type="button" className={`${styles.barBtn} ${styles.barIcon}`} onClick={() => inline.onExpand(current())} disabled={saving} aria-label={t('boardFullscreen')} title={t('boardFullscreen')}><Maximize2Icon size={15} /></button>
          <button type="button" className={`${styles.barBtn} ${styles.barIcon}`} onClick={onCancel} disabled={saving} aria-label={t('cancel')} title={t('cancel')}><XIcon size={15} /></button>
          <button type="button" className={`${styles.barBtn} ${styles.barPrimary}`} onClick={finish} disabled={saving}>
            {saving ? <Loader2Icon size={14} className="lecture-spin" /> : <CheckIcon size={14} />} {t('boardDoneShort')}
          </button>
        </div>
        <div className={styles.inlineBody} style={{ height: inline.height }}>{board}</div>
      </div>
    )
  }

  return createPortal(
    <div className={styles.editor} role="dialog" aria-label={t('boardEditTitle')}>
      <div className={styles.editorBar}>
        <span className={styles.editorTitle}><PresentationIcon size={16} /> {t('boardEditTitle')}</span>
        <span className={styles.editorHint}>{t('boardEditHint')}</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.barBtn} onClick={onCancel} disabled={saving}><XIcon size={15} /> {t('cancel')}</button>
        <button type="button" className={`${styles.barBtn} ${styles.barPrimary}`} onClick={finish} disabled={saving}>
          {saving ? <Loader2Icon size={15} className="lecture-spin" /> : <CheckIcon size={15} />} {t('boardDone')}
        </button>
      </div>
      <div className={styles.editorBody}>
        {board}
      </div>
    </div>,
    document.body,
  )
}
