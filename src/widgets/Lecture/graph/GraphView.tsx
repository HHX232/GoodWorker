'use client'

import { defaultGraphSpec, parseGraphSpec, type GraphSpec } from '@/shared/lib/lecture/graphSpec'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { LineChartIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { lectureCtx, uploadPhoto } from '../editor/photoTools'
import { boardAccess } from '../board/BoardView'
import { GraphChart, snapshotChart } from './GraphChart'
import { GraphEditorDialog } from './GraphEditorDialog'

/**
 * A graph block between paragraphs: the chart itself is drawn live (recharts)
 * from the spec kept in the node; Word gets a PNG snapshot (a LecturePhoto),
 * refreshed whenever the spec changes — so an AI-inserted graph or an edit
 * reaches the .docx without the student doing anything.
 */
export function GraphView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useTranslations('lecture')
  const spec = parseGraphSpec(node.attrs.spec)
  const snapOf = node.attrs.snapOf as string
  const key = spec ? JSON.stringify(spec) : ''
  const [open, setOpen] = useState(() => !spec && !!node.attrs.fresh && editor.isEditable)
  const host = useRef<HTMLDivElement>(null)

  // Snapshot once the chart has laid out; a newer spec cancels an older pending one.
  useEffect(() => {
    if (!spec || !editor.isEditable || snapOf === key) return
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!host.current) return
      try {
        const shot = await snapshotChart(host.current)
        if (!shot || cancelled) return
        const id = await uploadPhoto(lectureCtx.id, { file: new File([shot.blob], 'graph.png', { type: 'image/png' }), width: shot.width, height: shot.height, cropped: false })
        if (!cancelled) updateAttributes({ photoId: id, width: shot.width, height: shot.height, snapOf: key })
      } catch { /* the page still shows the live chart; the next change retries */ }
    }, 700)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, snapOf])

  const applied = useRef(false)
  const apply = (next: GraphSpec) => { applied.current = true; updateAttributes({ spec: next, fresh: false }) }

  return (
    <NodeViewWrapper className={`lecture-board lecture-graph ${selected ? 'is-selected' : ''}`} data-drag-handle>
      <div className="lecture-board-head" contentEditable={false}>
        <span className="lecture-board-tag"><LineChartIcon size={13} /> {spec?.title || t('graph')}</span>
        {editor.isEditable && (
          <>
            <button type="button" className="lecture-board-open" onClick={() => setOpen(true)}>{t('graphEdit')}</button>
            <button type="button" className="lecture-board-del" onClick={() => deleteNode()} aria-label={t('delete')} title={t('delete')}><Trash2Icon size={14} /></button>
          </>
        )}
      </div>
      <div ref={host} className="lecture-board-body lecture-graph-body" contentEditable={false} onDoubleClick={() => editor.isEditable && setOpen(true)}>
        {spec ? <GraphChart spec={spec} /> : <div className="lecture-board-empty">{t('graphEmpty')}</div>}
      </div>
      {open && (
        <GraphEditorDialog
          lectureId={lectureCtx.id}
          canUseAi={boardAccess.isVip || boardAccess.isAdmin}
          initial={spec ?? defaultGraphSpec()}
          isNew={!spec}
          onApply={apply}
          onClose={() => { setOpen(false); if (!spec && !applied.current) deleteNode() }} // a new block closed without a graph goes away
        />
      )}
    </NodeViewWrapper>
  )
}
