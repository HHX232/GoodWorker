// Role-based file matrix for "import test from document" (create-test's
// PdfImportModal, mirroring app/info-pdf-to-test's UploadModal):
//   - free teacher: unlimited .pdf, but only ONE non-pdf document (docx/txt/
//     rtf/odt) at a time, no photos
//   - VIP/admin teacher: everything, multiple files, photos capped at
//     MAX_PHOTOS (DeepSeek vision practical limit, same as the landing page)
export const DOC_EXTENSIONS = ['docx', 'txt', 'rtf', 'odt'] as const
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
export const MAX_PHOTOS = 10

export type FileKind = 'pdf' | 'doc' | 'image' | 'unknown'

export function extOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? ''
}

export function kindOf(filename: string): FileKind {
  const ext = extOf(filename)
  if (ext === 'pdf') return 'pdf'
  if ((DOC_EXTENSIONS as readonly string[]).includes(ext)) return 'doc'
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return 'image'
  return 'unknown'
}
