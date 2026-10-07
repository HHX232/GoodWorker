// Thin wrappers over the books API (app/api/tutor-files/books/**). Errors are FilesApiError(status, code) like the rest of Files.
import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { filesFetch, FilesApiError, jsonInit } from '../lib'
import { blobToDataUrl } from './coverCanvas'

export type BookCoverKind = 'found' | 'page1' | 'photo'

export interface UploadBookInput {
  file: File
  title: string
  spineColor: string
  pageCount: number | null
  cover?: { blob: Blob; kind: BookCoverKind } | null
  signal?: AbortSignal
}

export function uploadBook(input: UploadBookInput) {
  const form = new FormData()
  form.append('file', input.file)
  form.append('title', input.title)
  form.append('spineColor', input.spineColor)
  if (input.pageCount) form.append('pageCount', String(input.pageCount))
  if (input.cover) {
    form.append('cover', input.cover.blob, 'cover.jpg')
    form.append('coverKind', input.cover.kind)
  }
  return filesFetch<{ book: LibraryBook; usedBytes: number; quotaBytes: number }>('/api/tutor-files/books', { method: 'POST', body: form, signal: input.signal })
}

export interface UpdateBookInput {
  title?: string
  spineColor?: string
  /** A new cover picture (2:3 JPEG/PNG). */
  cover?: { blob: Blob; kind: BookCoverKind }
  /** Drop the picture → typographic cover. Ignored when `cover` is set. */
  resetCover?: boolean
}

export async function updateBook(id: string, input: UpdateBookInput): Promise<LibraryBook> {
  const url = `/api/tutor-files/books/${id}`
  if (input.cover) {
    const form = new FormData()
    if (input.title !== undefined) form.append('title', input.title)
    if (input.spineColor !== undefined) form.append('spineColor', input.spineColor)
    form.append('cover', input.cover.blob, 'cover.jpg')
    form.append('coverKind', input.cover.kind)
    return (await filesFetch<{ book: LibraryBook }>(url, { method: 'PATCH', body: form })).book
  }
  const { title, spineColor, resetCover } = input
  return (await filesFetch<{ book: LibraryBook }>(url, jsonInit('PATCH', { title, spineColor, ...(resetCover ? { resetCover: true } : {}) }))).book
}

export async function setBookSaved(id: string, saved: boolean): Promise<boolean> {
  return (await filesFetch<{ saved: boolean }>(`/api/tutor-files/books/${id}/save`, { method: saved ? 'PUT' : 'DELETE' })).saved
}

/** The book is a TutorFile — the generic delete removes the row and its cover object. */
export async function deleteBook(id: string): Promise<void> {
  await filesFetch(`/api/tutor-files/files/${id}`, { method: 'DELETE' })
}

/** Same-origin bytes (attachment) — works for the owner and for a student with a grant. */
export const bookContentUrl = (id: string) => `/api/tutor-files/files/${id}/content`

export type CoverCheck = 'cover' | 'plain' | 'unavailable'

/** Server-side vision check of page 1. Any failure (no key, timeout, network) is "unavailable", never an error. */
export async function checkBookCover(page: Blob, signal?: AbortSignal): Promise<CoverCheck> {
  try {
    const dataUrl = await blobToDataUrl(page)
    const timeout = AbortSignal.timeout(20_000) // the server gives up after 12 s; this only guards a hung connection
    // AbortSignal.any is missing before Safari 17.4 — then the timeout alone guards the request (cancel just drops the late answer in the modal).
    const combined = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : timeout
    const res = await filesFetch<{ isCover?: boolean; error?: string }>('/api/tutor-files/books/cover-check', {
      ...jsonInit('POST', { imageBase64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: page.type || 'image/jpeg' }),
      signal: combined,
    })
    return typeof res.isCover === 'boolean' ? (res.isCover ? 'cover' : 'plain') : 'unavailable'
  } catch (e) {
    // Network, abort, timeout and a server-side UNAVAILABLE are expected; a 4xx (bad request, no access) is worth a trace.
    if (e instanceof FilesApiError) console.warn('[checkBookCover] request refused', e.status, e.code)
    return 'unavailable'
  }
}

export { FilesApiError }
