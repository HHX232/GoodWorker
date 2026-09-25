// Client mirrors of GET /api/tutor-files/library — import these in client
// components, not the server modules in shared/lib/tutorFiles (those pull in
// Prisma/auth()). Dates arrive as ISO strings over JSON.

export interface FilesPerson {
  id: string
  name: string
  avatarUrl: string | null
}

export interface LibraryFolder {
  id: string
  name: string
  parentId: string | null
  allowStudentUpload: boolean
  /** Set only on a student's personal "учебная" subfolder (G03). */
  restrictedToStudentId: string | null
  /** `preset:<id>` / image URL / null — resolve with `resolveCover()` (shared/lib/tutorFiles/covers). */
  cover: string | null
  /** Direct subfolders + files, as visible to the viewer. */
  itemCount: number
  /** Teacher view only: students holding a direct grant. */
  sharedWith: FilesPerson[]
  updatedAt: string
}

export interface LibraryFile {
  id: string
  name: string
  folderId: string | null
  url: string
  sizeBytes: number
  mimeType: string
  uploadedByRole: 'TEACHER' | 'STUDENT' | 'ADMIN'
  uploadedById: string
  createdAt: string
  /** Teacher view only: students holding a direct grant. */
  sharedWith: FilesPerson[]
}

export interface LibraryGroup {
  /** `null` in the teacher's own library; the owning tutor in a student's view. */
  teacher: FilesPerson | null
  folders: LibraryFolder[]
  files: LibraryFile[]
}

export interface TreeNode {
  id: string
  name: string
  /** `null` at the top of what the viewer can see (a student's granted folder whose parent isn't visible to them). */
  parentId: string | null
  teacherId: string
  restrictedToStudentId: string | null
  cover: string | null
}

export interface LibraryResponse {
  role: 'TEACHER' | 'STUDENT'
  /** The open folder, `null` at the root. */
  folder: { id: string; name: string; allowStudentUpload: boolean; restrictedToStudentId: string | null; depth: number } | null
  /** Root → open folder's parent, only levels the viewer can see. */
  breadcrumbs: { id: string; name: string }[]
  groups: LibraryGroup[]
  tree: TreeNode[]
  /** Student only: every tutor who shares something with the viewer (labels the sidebar tree). */
  teachers: FilesPerson[]
  /** Viewer may upload into the open folder (teacher: always; student: only their own subfolder). */
  canUpload: boolean
  /** Teacher only: VIP active — write actions allowed (G01). */
  isVip: boolean
}

export interface UsageResponse {
  usedBytes: number
  quotaBytes: number
  overageGb: number
  priceCentsPerGbMonth: number
  /** What the monthly cron would charge right now (overageGb × price), USD cents. */
  estimatedChargeCents: number
  /** Wallet display rate — ru shows BYN, other locales USD (same rule as /vip). */
  usdToBynRate: number
}
