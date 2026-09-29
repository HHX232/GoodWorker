import { compressImageForUpload } from '@/shared/helpers/compressImageForUpload'
import { autoCropPagePhoto } from '@/shared/lib/pageAutoCrop'
import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { docText } from './docOps'

/** Which lecture the editor on this page belongs to — node views read it (they live outside React props). */
export const lectureCtx: { id: string } = { id: '' }

export const photoUrl = (lectureId: string, photoId: string) => `/api/lecture/${lectureId}/photos/${photoId}`

export interface PreparedPhoto {
  file: File
  width: number
  height: number
  /** A page/sheet was found and the photo straightened to it. */
  cropped: boolean
}

async function dims(file: Blob): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file)
    const out = { width: bmp.width, height: bmp.height }
    bmp.close()
    return out
  } catch {
    return { width: 1600, height: 1200 }
  }
}

/**
 * Board/notebook photo → a JPEG ready to upload: optionally cropped to the
 * sheet (the same detector /files uses for notebook pages), then downscaled.
 */
export async function preparePhoto(original: File, crop: boolean): Promise<PreparedPhoto> {
  let file = original
  let cropped = false
  if (crop) {
    const c = await autoCropPagePhoto(original).catch(() => null)
    if (c) { file = c; cropped = true }
  }
  const jpeg = await compressImageForUpload(file, 2400, 2400, 0.85).catch(() => file)
  const out = jpeg.type === 'image/jpeg' ? jpeg : new File([jpeg], 'photo.jpg', { type: 'image/jpeg' })
  return { file: out, ...(await dims(out)), cropped }
}

export class PhotoError extends Error {}

export async function uploadPhoto(lectureId: string, p: PreparedPhoto): Promise<string> {
  const form = new FormData()
  form.append('photo', p.file)
  form.append('width', String(p.width))
  form.append('height', String(p.height))
  const res = await fetch(`/api/lecture/${lectureId}/photos`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new PhotoError(data.error ?? 'UPLOAD_FAILED')
  return data.photo.id as string
}

export async function readPhotoContent(lectureId: string, photo: File, context: string): Promise<JSONContent[]> {
  const form = new FormData()
  form.append('photo', photo)
  form.append('context', context)
  const res = await fetch(`/api/lecture/${lectureId}/photo-read`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new PhotoError(data.error ?? 'AI_FAILED')
  return data.blocks ?? []
}

export function photoNode(photoId: string, p: { width: number; height: number }): JSONContent {
  return { type: 'lecturePhoto', attrs: { photoId, width: p.width, height: p.height, size: 'full' } }
}

/** Position right after the block that contains `pos` (inside an AI section if it's in one). */
export function afterBlock(editor: Editor, pos: number): number {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size))
  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d - 1)
    if (parent.type.name === 'doc' || parent.type.name === 'aiSection') return $pos.after(d)
  }
  return editor.state.doc.content.size
}

export interface BlockAnchor { text: string; end: number }

/** The notes as a flat list of blocks (AI sections opened up) — the outline DeepSeek numbers. */
export function blockAnchors(doc: PMNode): BlockAnchor[] {
  const out: BlockAnchor[] = []
  const visit = (node: PMNode, pos: number) => {
    if (node.type.name === 'aiSection') {
      node.forEach((child, offset) => visit(child, pos + 1 + offset))
      return
    }
    const text = docText(doc, pos, pos + node.nodeSize).replace(/\s+/g, ' ').trim()
    if (text || node.type.name === 'lecturePhoto') out.push({ text: text || '[фото]', end: pos + node.nodeSize })
  }
  doc.forEach((node, offset) => visit(node, offset))
  return out
}
