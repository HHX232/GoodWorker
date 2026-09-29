// Client mirror of GET /api/student-files/library (dates are ISO strings over JSON).

export interface DriveFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  itemCount: number
}

export interface DriveFile {
  id: string
  name: string
  sizeBytes: number
  mimeType: string
  url: string
  /** Set on a saved lecture — opening goes back to /lecture/<id>. */
  lectureNoteId: string | null
  createdAt: string
  updatedAt: string
}

export interface DriveLibraryResponse {
  folder: { id: string; name: string; parentId: string | null } | null
  breadcrumbs: { id: string; name: string }[]
  folders: DriveFolder[]
  files: DriveFile[]
  usedBytes: number
  quotaBytes: number
  maxFileBytes: number
  isVip: boolean
}
