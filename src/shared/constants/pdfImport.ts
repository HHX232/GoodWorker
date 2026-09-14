// Role-based file matrix for "import test from document" (create-test's
// PdfImportModal, mirroring app/info-pdf-to-test's UploadModal):
//   - free teacher: unlimited .pdf, but only ONE non-pdf document (docx/txt/
//     rtf/odt) at a time, no photos
//   - VIP/admin teacher: everything, multiple files, photos capped at
//     MAX_PHOTOS (DeepSeek vision practical limit, same as the landing page)
export const DOC_EXTENSIONS = ['docx', 'txt', 'rtf', 'odt'] as const
// iPhones save photos as HEIC/HEIF by default — accepted here, but they need
// client-side conversion to JPEG before upload (see src/shared/lib/heicConvert.ts):
// no vision AI and no non-Safari browser can read HEIC directly.
export const HEIC_EXTENSIONS = ['heic', 'heif'] as const
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', ...HEIC_EXTENSIONS] as const
export const MAX_PHOTOS = 10

export type FileKind = 'pdf' | 'doc' | 'image' | 'unknown'

export function extOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? ''
}

export function isHeic(filename: string): boolean {
  return (HEIC_EXTENSIONS as readonly string[]).includes(extOf(filename))
}

export function kindOf(filename: string): FileKind {
  const ext = extOf(filename)
  if (ext === 'pdf') return 'pdf'
  if ((DOC_EXTENSIONS as readonly string[]).includes(ext)) return 'doc'
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return 'image'
  return 'unknown'
}
