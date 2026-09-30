import type { ComponentType } from 'react'
import {
  FileArchiveIcon, FileCheckIcon, FileIcon, FileImageIcon, FileMusicIcon, FilePlusIcon, FileTextIcon, FileVideoIcon,
} from 'lucide-react'

export type FileKind = 'pdf' | 'image' | 'video' | 'audio' | 'doc' | 'sheet' | 'presentation' | 'text' | 'archive' | 'other'

function extOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
}

export function fileKind(mimeType: string, name: string): FileKind {
  const ext = extOf(name)
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (/excel|sheet|spreadsheet/.test(mimeType) || ['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'sheet'
  if (/powerpoint|presentation/.test(mimeType) || ['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation'
  if (/word|msword|opendocument\.text/.test(mimeType) || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'doc'
  if (/zip|rar|7z|tar|gzip|archive/.test(mimeType) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (mimeType.startsWith('text/') || ['txt', 'md', 'json', 'log', 'xml', 'yml', 'yaml'].includes(ext)) return 'text'
  return 'other'
}

// Same icon + colour per type as the road-map file blocks
// (src/widgets/RoadMap/UI/nodes/OtherBlocks/FileRow/FileRow.tsx), so a file
// looks the same wherever it shows up in the app.
export const KIND_ICON: Record<FileKind, ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
  image: FileImageIcon,
  video: FileVideoIcon,
  audio: FileMusicIcon,
  pdf: FileTextIcon,
  doc: FileTextIcon,
  sheet: FileCheckIcon,
  presentation: FilePlusIcon,
  text: FileTextIcon,
  archive: FileArchiveIcon,
  other: FileIcon,
}

export const KIND_COLOR: Record<FileKind, string> = {
  image: '#10b981',
  video: '#6366f1',
  audio: '#f59e0b',
  pdf: '#ef4444',
  doc: '#2563eb',
  sheet: '#16a34a',
  presentation: '#ea580c',
  text: '#3b82f6',
  archive: '#8b5cf6',
  other: '#868897',
}

/** Which in-app viewer opens this file; null → download only. */
export type ViewerKind = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'sheet' | 'docx'

export function viewerFor(mimeType: string, name: string): ViewerKind | null {
  const kind = fileKind(mimeType, name)
  const ext = extOf(name)
  if (kind === 'pdf' || kind === 'image' || kind === 'video' || kind === 'audio') return kind
  if (['csv', 'xlsx', 'xls', 'ods'].includes(ext)) return 'sheet'
  if (ext === 'docx') return 'docx'
  if (kind === 'text') return 'text'
  return null
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

/**
 * Wallet amounts are USD cents internally; ru shows BYN at the admin's
 * `usdToBynRate`, every other locale USD — the same rule /vip uses
 * (useVipTopUpPresets.formatCentsDisplay).
 */
export function formatMoney(cents: number, locale: string, usdToBynRate: number): string {
  if (locale === 'ru') return `${((cents / 100) * usdToBynRate).toFixed(2)} BYN`
  return `$${(cents / 100).toFixed(2)}`
}

/** Corner/tab sizes are tuned for the 156px card and scale down with height (cover swatches are ~48px). */
function folderMetrics(w: number, h: number) {
  const k = Math.min(1, h / 156)
  return { k, tw: Math.min(Math.max(w * 0.4, 96 * k), 170) }
}

/**
 * Floe-style folder silhouette for a w×h box: a rounded tab on the top-left
 * that flows into the body with an S-curve. Pixel-exact per size (corners
 * never stretch), fed to CSS `clip-path: path()` and an SVG outline.
 */
export function folderFrontPath(w: number, h: number): string {
  const { k, tw } = folderMetrics(w, h)
  const r = 18 * k
  const rt = 12 * k
  const th = 14 * k
  const s = 20 * k
  return `M0 ${rt} Q0 0 ${rt} 0 L${tw - s} 0 C${tw - s / 2} 0 ${tw - s / 2} ${th} ${tw} ${th} L${w - r} ${th} Q${w} ${th} ${w} ${th + r} L${w} ${h - r} Q${w} ${h} ${w - r} ${h} L${r} ${h} Q0 ${h} 0 ${h - r} Z`
}

/** The sheet peeking out behind the front on the right — a rounded rect a little lower than the tab. */
export function folderBackPath(w: number, h: number): string {
  const { k, tw } = folderMetrics(w, h)
  const r = 16 * k
  const top = 5 * k
  const inset = 4 * k
  const left = tw - 30 * k
  // Ends well above the front's bottom so no anti-aliased fringe shows under it.
  const b = Math.min(h, top + 60 * k)
  return `M${left} ${top + r} Q${left} ${top} ${left + r} ${top} L${w - r - inset} ${top} Q${w - inset} ${top} ${w - inset} ${top + r} L${w - inset} ${b - r} Q${w - inset} ${b} ${w - r - inset} ${b} L${left + r} ${b} Q${left} ${b} ${left} ${b - r} Z`
}

/** Starts a download of the public file URL (new tab fallback where `download` is ignored cross-origin). */
export function triggerDownload(file: { url: string; name: string }): void {
  const a = document.createElement('a')
  a.href = file.url
  a.download = file.name
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.click()
}

/** Deadline / access-window dates: "12 окт., 18:00"; `short` drops the time. */
export function formatDeadline(iso: string, locale: string, short = false): string {
  try {
    return new Date(iso).toLocaleString(locale, short
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
