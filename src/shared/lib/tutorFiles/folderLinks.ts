import { prisma } from '@/shared/prisma/prisma'
import type { TutorFolder } from '@prisma/client'
import type { TutorFileRow } from './readModel'

export interface LinkedSubtree {
  root: TutorFolder
  folders: TutorFolder[]
  files: TutorFileRow[]
  teacher: { id: string; name: string; avatarUrl: string | null }
}

const MAX_LINKED_FILES = 500

/**
 * Everything under a folder attached by link — the root, its descendant
 * folders and their files. Students' personal "учебная" subfolders (and what
 * they submitted there) are excluded: a link is for the tutor's material, not
 * for one student's work.
 */
export async function loadLinkedSubtree(token: string): Promise<LinkedSubtree | null> {
  const link = await prisma.tutorFolderLink.findUnique({ where: { token }, include: { folder: true } })
  if (!link) return null
  const root = link.folder
  const descendants = await prisma.tutorFolder.findMany({
    where: { ancestorIds: { has: root.id }, restrictedToStudentId: null },
    orderBy: { name: 'asc' },
  })
  const folders = [root, ...descendants]
  const [files, teacher] = await Promise.all([
    prisma.tutorFile.findMany({ where: { folderId: { in: folders.map(f => f.id) } }, orderBy: { name: 'asc' }, take: MAX_LINKED_FILES }),
    prisma.teacher.findUnique({ where: { id: root.teacherId }, select: { id: true, name: true, avatarUrl: true } }),
  ])
  return { root, folders: descendants, files, teacher: teacher ?? { id: root.teacherId, name: '', avatarUrl: null } }
}
