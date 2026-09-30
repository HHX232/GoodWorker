'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CropIcon, Loader2Icon, MaximizeIcon, MinimizeIcon, ScanTextIcon, Trash2Icon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { afterBlock, lectureCtx, photoFailedToast, photoUrl, preparePhoto, readPhotoContent, uploadPhoto } from './photoTools'

/**
 * A photo placed into the notes. Selected → a small toolbar: crop to the
 * sheet (notebook page / board detector), turn into text, half/full width,
 * delete. Served through our API, never the bucket's public URL.
 */
export function PhotoView({ node, updateAttributes, deleteNode, editor, selected, getPos }: NodeViewProps) {
  const t = useTranslations('lecture')
  const [busy, setBusy] = useState<null | 'crop' | 'read'>(null)
  const lectureId = lectureCtx.id
  const { photoId, width, height, size } = node.attrs as { photoId: string; width: number; height: number; size: 'full' | 'half' }
  const src = photoUrl(lectureId, photoId)

  const fetchFile = async () => {
    const res = await fetch(src)
    if (!res.ok) throw new Error('fetch')
    return new File([await res.blob()], 'photo.jpg', { type: 'image/jpeg' })
  }

  const crop = async () => {
    setBusy('crop')
    try {
      const prepared = await preparePhoto(await fetchFile(), true)
      if (!prepared.cropped) { toast.message(t('cropNotFound')); return }
      const id = await uploadPhoto(lectureId, prepared)
      updateAttributes({ photoId: id, width: prepared.width, height: prepared.height })
      toast.success(t('cropDone'))
    } catch {
      toast.error(t('photoFailed'))
    } finally {
      setBusy(null)
    }
  }

  const read = async () => {
    setBusy('read')
    try {
      const pos = typeof getPos === 'function' ? getPos() : undefined
      const blocks = await readPhotoContent(lectureId, await fetchFile(), '')
      if (!blocks.length) { toast.message(t('photoNothing')); return }
      const at = pos === undefined ? editor.state.doc.content.size : afterBlock(editor, pos + 1)
      editor.chain().insertContentAt(at, blocks).run()
    } catch (e) {
      if (e instanceof Error && e.message === 'VIP_REQUIRED') toast.error(t('vipOnly'))
      else photoFailedToast({ message: t('photoFailed'), retryLabel: t('photoRetry'), retry: read })
    } finally {
      setBusy(null)
    }
  }

  return (
    <NodeViewWrapper className={`lecture-photo ${size === 'half' ? 'is-half' : ''} ${selected ? 'is-selected' : ''}`} data-drag-handle>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={width} height={height} loading="lazy" draggable={false} />
      {busy && <span className="lecture-photo-busy"><Loader2Icon size={18} className="lecture-spin" /> {busy === 'crop' ? t('cropping') : t('reading')}</span>}
      {selected && editor.isEditable && !busy && (
        <div className="lecture-photo-bar" contentEditable={false}>
          <button type="button" className="is-primary" onClick={crop}><CropIcon size={14} /> {t('cropSheet')}</button>
          <button type="button" onClick={read}><ScanTextIcon size={14} /> {t('photoToText')}</button>
          <button type="button" onClick={() => updateAttributes({ size: size === 'half' ? 'full' : 'half' })} aria-label={size === 'half' ? t('photoFull') : t('photoHalf')} title={size === 'half' ? t('photoFull') : t('photoHalf')}>
            {size === 'half' ? <MaximizeIcon size={14} /> : <MinimizeIcon size={14} />}
          </button>
          <button type="button" onClick={() => deleteNode()} aria-label={t('delete')} title={t('delete')}><Trash2Icon size={14} /></button>
        </div>
      )}
    </NodeViewWrapper>
  )
}
