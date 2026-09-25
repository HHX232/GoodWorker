import type { ComponentType } from 'react'
import {
  FilesArchiveIcon, FilesAudioIcon, FilesDocIcon, FilesFileIcon, FilesImageIcon, FilesPdfIcon, FilesSheetIcon, FilesVideoIcon,
} from './icons'

export type FileKind = 'pdf' | 'image' | 'sheet' | 'doc' | 'archive' | 'video' | 'audio' | 'other'

export function fileKind(mimeType: string, name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (/sheet|excel|csv/.test(mimeType) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet'
  if (/zip|rar|7z|tar|gzip/.test(mimeType) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (/word|document|presentation|powerpoint|text/.test(mimeType) || ['doc', 'docx', 'ppt', 'pptx', 'txt', 'odt', 'rtf'].includes(ext)) return 'doc'
  return 'other'
}

export const KIND_ICON: Record<FileKind, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  pdf: FilesPdfIcon,
  image: FilesImageIcon,
  sheet: FilesSheetIcon,
  doc: FilesDocIcon,
  archive: FilesArchiveIcon,
  video: FilesVideoIcon,
  audio: FilesAudioIcon,
  other: FilesFileIcon,
}

/** G05: only PDFs and images open in the built-in viewer; everything else downloads. */
export function isPreviewable(kind: FileKind): boolean {
  return kind === 'pdf' || kind === 'image'
}

/** `12 МБ` / `3.4 GB` — the unit name comes from Intl, so every locale reads its own. */
export function formatBytes(bytes: number, locale: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: units[i], unitDisplay: 'short', maximumFractionDigits: value < 10 && i > 0 ? 1 : 0 }).format(value)
  } catch {
    return `${value.toFixed(1)} ${['B', 'KB', 'MB', 'GB'][i]}`
  }
}

export function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export class FilesApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

/** fetch → JSON, throwing `FilesApiError(status, body.error)` on a non-2xx. */
export async function filesFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new FilesApiError(res.status, typeof body?.error === 'string' ? body.error : 'ERROR')
  return body as T
}

export function jsonInit(method: string, data: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}
