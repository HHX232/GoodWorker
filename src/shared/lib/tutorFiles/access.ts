import { prisma } from '@/shared/prisma/prisma'
import type { TutorFile, TutorFolder } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { hasTeacherStudentLink } from '../chat/access'

export type FilesRole = 'TEACHER' | 'STUDENT'

export interface FilesSessionUser {
  id: string
  role: FilesRole
}

/**
 * Same ADMIN->TEACHER mapping as `getChatSessionUser()` (chat/access.ts) —
 * the seed tutor account logs in with role ADMIN (site-wide privilege
 * layered on a real Teacher row), so every route that tells
 * teacher/student apart treats ADMIN as TEACHER with the same `id`.
 */
export async function getFilesSessionUser(): Promise<FilesSessionUser | null> {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id) return null
  if (role === 'TEACHER' || role === 'ADMIN') return { id: session.user.id, role: 'TEACHER' }
  if (role === 'STUDENT') return { id: session.user.id, role: 'STUDENT' }
  return null
}

/** Re-exported, not duplicated — `interfaces.md` "Границы" table. */
export { hasTeacherStudentLink }

export interface VisibilityItem {
  id: string
  ancestorIds: string[]
  restrictedToStudentId: string | null
}

/**
 * Правило видимости (interfaces.md "Правило видимости"):
 * 1. есть явный грант (id в `grantedIds`) на сам элемент или на любого
 *    предка из `item.ancestorIds`, И
 * 2. `item.restrictedToStudentId` либо `null`, либо равен `studentId`.
 *
 * `restrictedToStudentId` only ever gets set on the leaf "учебная"
 * per-student subfolder auto-created under an `allowStudentUpload` folder
 * (interfaces.md, `storage.ts` boundary) — never on a folder that itself
 * has restricted descendants belonging to a *different* student — so
 * checking the item's own field (not walking ancestors' own restriction
 * values, which this shape doesn't carry) is enough to satisfy the rule for
 * every shape this build produces, including a sibling student's restricted
 * subfolder becoming visible via a grant on their shared parent (ticket 01
 * acceptance criteria, scenario 4).
 */
export function canStudentSee(item: VisibilityItem, studentId: string, grantedIds: Set<string>): boolean {
  const hasGrant = grantedIds.has(item.id) || item.ancestorIds.some(ancestorId => grantedIds.has(ancestorId))
  if (!hasGrant) return false
  return item.restrictedToStudentId === null || item.restrictedToStudentId === studentId
}

type OwnedFolderResult = { folder: TutorFolder; response?: undefined } | { folder?: undefined; response: NextResponse }
type OwnedFileResult = { file: TutorFile; response?: undefined } | { file?: undefined; response: NextResponse }

const STATUS_MESSAGE: Record<404 | 403, string> = { 404: 'Not found', 403: 'Forbidden' }

/** Guard for routes operating on an existing folder — by analogy with `requireOwnedConversation`. */
export async function requireOwnedFolder(folderId: string, teacherId: string): Promise<OwnedFolderResult> {
  const folder = await prisma.tutorFolder.findUnique({ where: { id: folderId } })
  if (!folder) return { response: NextResponse.json({ error: STATUS_MESSAGE[404] }, { status: 404 }) }
  if (folder.teacherId !== teacherId) return { response: NextResponse.json({ error: STATUS_MESSAGE[403] }, { status: 403 }) }
  return { folder }
}

/** Guard for routes operating on an existing file — by analogy with `requireOwnedConversation`. */
export async function requireOwnedFile(fileId: string, teacherId: string): Promise<OwnedFileResult> {
  const file = await prisma.tutorFile.findUnique({ where: { id: fileId } })
  if (!file) return { response: NextResponse.json({ error: STATUS_MESSAGE[404] }, { status: 404 }) }
  if (file.teacherId !== teacherId) return { response: NextResponse.json({ error: STATUS_MESSAGE[403] }, { status: 403 }) }
  return { file }
}

/**
 * G01 server-side: the library's write operations (create folder, upload,
 * grant) are VIP-only. Same expiry rule as the storage-overage cron —
 * `isVip` alone isn't enough, an expired `vipExpiresAt` means not VIP.
 */
export async function isTeacherVipActive(teacherId: string): Promise<boolean> {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { isVip: true, vipExpiresAt: true } })
  if (!teacher?.isVip) return false
  return teacher.vipExpiresAt === null || teacher.vipExpiresAt > new Date()
}

export function vipRequiredResponse(): NextResponse {
  return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })
}

export interface StudentVisibility {
  grantedIds: Set<string>
  /** Every folder the student can see (granted directly or via a granted ancestor, minus other students' restricted subfolders). */
  folders: TutorFolder[]
  /** Every file the student can see. */
  files: TutorFile[]
}

/** A file has no `ancestorIds`/`restrictedToStudentId` of its own — both come from its folder (interfaces.md "Правило видимости"). */
export function fileVisibilityItem(file: { id: string }, folder: { id: string; ancestorIds: string[]; restrictedToStudentId: string | null } | null): VisibilityItem {
  return {
    id: file.id,
    ancestorIds: folder ? [...folder.ancestorIds, folder.id] : [],
    restrictedToStudentId: folder?.restrictedToStudentId ?? null,
  }
}

/**
 * The student's whole visible library in three queries: the DB narrows to
 * candidates (direct grant, or under a granted folder), `canStudentSee()` is
 * the actual filter — shared by the library read model and search so both
 * apply the one rule.
 */
export async function loadStudentVisibility(studentId: string): Promise<StudentVisibility> {
  const [folderGrants, fileGrants] = await Promise.all([
    prisma.tutorFolderGrant.findMany({ where: { studentId }, select: { folderId: true } }),
    prisma.tutorFileGrant.findMany({ where: { studentId }, select: { fileId: true } }),
  ])
  const grantedFolderIds = folderGrants.map(g => g.folderId)
  const grantedFileIds = fileGrants.map(g => g.fileId)
  const grantedIds = new Set([...grantedFolderIds, ...grantedFileIds])
  if (grantedIds.size === 0) return { grantedIds, folders: [], files: [] }

  const candidateFolders = grantedFolderIds.length
    ? await prisma.tutorFolder.findMany({
        where: { OR: [{ id: { in: grantedFolderIds } }, { ancestorIds: { hasSome: grantedFolderIds } }] },
        orderBy: { name: 'asc' },
      })
    : []
  const folders = candidateFolders.filter(f => canStudentSee(f, studentId, grantedIds))
  const folderById = new Map(candidateFolders.map(f => [f.id, f]))

  const fileOr = [
    ...(grantedFileIds.length ? [{ id: { in: grantedFileIds } }] : []),
    ...(candidateFolders.length ? [{ folderId: { in: candidateFolders.map(f => f.id) } }] : []),
  ]
  const candidateFiles = fileOr.length
    ? await prisma.tutorFile.findMany({
        where: { OR: fileOr },
        include: { folder: { select: { id: true, ancestorIds: true, restrictedToStudentId: true } } },
        orderBy: { name: 'asc' },
      })
    : []
  const files = candidateFiles
    .filter(file => canStudentSee(fileVisibilityItem(file, file.folder ?? (file.folderId ? folderById.get(file.folderId) ?? null : null)), studentId, grantedIds))
    .map(({ folder: _folder, ...file }) => file)

  return { grantedIds, folders, files }
}
