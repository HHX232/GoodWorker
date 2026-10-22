// Client mirrors of GET /api/tutor-files/library — import these in client
// components, not the server modules in shared/lib/tutorFiles (those pull in
// Prisma/auth()). Dates arrive as ISO strings over JSON.

export interface FilesPerson {
  id: string
  name: string
  avatarUrl: string | null
  /** Teacher view, grant avatars only: when this student first opened the item (null = not yet). */
  firstOpenedAt?: string | null
  /** Teacher view, grant avatars only: scheduled access window (idea 5). */
  availableFrom?: string | null
  availableUntil?: string | null
}

/**
 * Teacher view, homework folders only: how far the submissions are. On a
 * submissions folder (`unit: 'students'`) the units are the students holding
 * access; on a student's personal subfolder (`unit: 'files'`) they are that
 * student's uploads. `total` = done + waiting + working + notStarted.
 */
export interface SubmissionProgress {
  unit: 'students' | 'files'
  /** Submitted and accepted. */
  done: number
  /** Submitted, not reviewed yet. */
  waiting: number
  /** Sent back for revision — the student is working on it. */
  working: number
  /** Nothing submitted (students only). */
  notStarted: number
  total: number
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
  /** Submissions folder deadline (idea 2), ISO. */
  submissionDeadline: string | null
  /** Direct subfolders + files, as visible to the viewer. */
  itemCount: number
  /** Teacher view only: students holding a direct grant. */
  sharedWith: FilesPerson[]
  /** Teacher view: students with access to something inside this folder but no direct grant on it. */
  nestedWith?: FilesPerson[]
  /** Teacher view, homework folders only. */
  progress?: SubmissionProgress | null
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
  /** A student submission uploaded after the submissions folder's deadline. */
  late: boolean
  /** The tutor's check of a student submission (idea 1). */
  review: FileReview | null
  /** Set on a file the in-browser docx editor saved "as new" — the id it was derived from. Editing this file again overwrites it in place instead of spawning another copy. */
  derivedFromId: string | null
  /** Set on a tutor's saved /lecture notes — opening goes back to /lecture/<id>. */
  lectureNoteId?: string | null
}

export interface FileReview {
  status: 'ACCEPTED' | 'REVISION'
  grade: string | null
  comment: string | null
  /** Transparent PNG pen overlays, one per marked page (images: page 1). */
  annotations: { page: number; url: string }[]
  reviewedAt: string
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

/** A book (TutorFile with `isBook`) as the viewer sees it. */
export interface LibraryBook {
  /** = TutorFile.id */
  id: string
  title: string
  teacherId: string
  teacherName: string
  pageCount: number | null
  sizeBytes: number
  /** ISO. */
  addedAt: string
  /** `kind: null` / `url: null` = typographic cover drawn from `spineColor` + the title. `spineColor` is always `#RRGGBB`. */
  cover: { kind: 'found' | 'page1' | 'photo' | null; url: string | null; spineColor: string }
  /** "Мои книги" bookmark of the viewer. */
  saved: boolean
  /** The viewer's own reading progress (`pct` 0..100). */
  progress: { lastPage: number; pct: number; updatedAt: string } | null
  /** Teacher view only: students holding a direct grant. */
  sharedWith: FilesPerson[]
}

/** One page bookmark of the viewer inside a book. */
export interface BookBookmark {
  id: string
  page: number
  label: string | null
  /** ISO. */
  createdAt: string
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'pink', 'blue'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/** One rectangle of a highlight, as fractions (0..1) of the page's width/height. */
export interface HighlightRect {
  x: number
  y: number
  w: number
  h: number
}

/** A personal text highlight (with an optional single comment) in a book. */
export interface BookHighlight {
  id: string
  page: number
  text: string
  rects: HighlightRect[]
  color: HighlightColor
  note: string | null
  /** ISO. */
  createdAt: string
}

/** GET /api/tutor-files/books/[id]/presence (owner only). Keys of `pages` are page numbers; pages nobody touched are absent. */
export interface BookPresencePage {
  /** Students whose last page is this one; `stoppedAt` = when (ISO). */
  stoppedHere: (FilesPerson & { stoppedAt: string })[]
  /** Students who read this page earlier (not those in `stoppedHere`), newest first. */
  readBy: { person: FilesPerson; lastReadAt: string }[]
}
export interface BookPresence {
  pages: Record<number, BookPresencePage>
}

export interface LibraryResponse {
  role: 'TEACHER' | 'STUDENT'
  /** The open folder, `null` at the root. */
  folder: {
    id: string
    name: string
    allowStudentUpload: boolean
    restrictedToStudentId: string | null
    depth: number
    /** For a personal submissions subfolder: the parent's deadline (idea 2). */
    deadline: string | null
  } | null
  /** Root → open folder's parent, only levels the viewer can see. */
  breadcrumbs: { id: string; name: string }[]
  groups: LibraryGroup[]
  tree: TreeNode[]
  /** Student only: every tutor who shares something with the viewer (labels the sidebar tree). */
  teachers: FilesPerson[]
  /** Books the viewer sees: all of the tutor's (teacher) / those with an active grant (student) at the root; `[]` inside a folder. Books are NOT repeated in `groups[].files`. */
  books: LibraryBook[]
  /** Viewer may upload into the open folder (teacher: always; student: only their own subfolder). */
  canUpload: boolean
  /** Teacher only: VIP active — write actions allowed (G01). */
  isVip: boolean
  /** Teacher only: the storage quota (admin-set), for copy like the VIP upsell. 0 for students. */
  quotaBytes: number
}

export interface UsageResponse {
  usedBytes: number
  quotaBytes: number
  maxFileBytes: number
  overageGb: number
  /** Wallet build only: overage is billed monthly. `null` → the quota is a hard cap (uploads past it are refused). */
  billing: {
    priceCentsPerGbMonth: number
    /** What the monthly cron would charge right now (overageGb × price), USD cents. */
    estimatedChargeCents: number
    /** Wallet display rate — ru shows BYN, other locales USD (same rule as /vip). */
    usdToBynRate: number
  } | null
}

/** GET /api/tutor-files/links/[token] — a folder attached by link (read-only subtree). */
export interface LinkedFolderResponse {
  folder: { id: string; name: string; cover: string | null }
  teacher: FilesPerson
  /** Descendant folders (the root excluded); `parentId` chains back to `folder.id`. */
  folders: { id: string; name: string; parentId: string | null }[]
  files: LibraryFile[]
}

/** What editors store for an attached folder (inside their usual file-entry shape). */
export interface AttachedFolderRef {
  token: string
  folderId: string
  itemCount: number
}

/** GET /api/tutor-files/search file hit: plus the passage where the query was found inside the file (idea 8). */
export type SearchFile = LibraryFile & { contentMatch: string | null }
