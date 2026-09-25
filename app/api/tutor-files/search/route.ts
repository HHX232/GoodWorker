import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canStudentSee, getFilesSessionUser } from '@/shared/lib/tutorFiles/access'

// GET /api/tutor-files/search?q=... — teacher searches their whole library by
// name; student searches only their granted subset, via the same
// canStudentSee() rule from ticket 01 (not a re-derived heuristic): the DB
// query narrows to items that could possibly pass (direct grant, or a
// granted ancestor folder), then canStudentSee is the actual filter, so this
// stays correct if the visibility rule ever changes shape.
export async function GET(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) return NextResponse.json({ folders: [], files: [] })

    if (user.role === 'TEACHER') {
      const [folders, files] = await Promise.all([
        prisma.tutorFolder.findMany({ where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' } }),
        prisma.tutorFile.findMany({ where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' } }),
      ])
      return NextResponse.json({ folders, files })
    }

    // STUDENT
    const [folderGrants, fileGrants] = await Promise.all([
      prisma.tutorFolderGrant.findMany({ where: { studentId: user.id }, select: { folderId: true } }),
      prisma.tutorFileGrant.findMany({ where: { studentId: user.id }, select: { fileId: true } }),
    ])
    const grantedFolderIds = folderGrants.map(g => g.folderId)
    const grantedFileIds = fileGrants.map(g => g.fileId)
    if (grantedFolderIds.length === 0 && grantedFileIds.length === 0) return NextResponse.json({ folders: [], files: [] })
    const grantedIds = new Set([...grantedFolderIds, ...grantedFileIds])

    // Every folder that could pass canStudentSee: granted directly, or a
    // descendant of a granted folder (its ancestorIds contains one).
    const visibleFolders = grantedFolderIds.length
      ? await prisma.tutorFolder.findMany({ where: { OR: [{ id: { in: grantedFolderIds } }, { ancestorIds: { hasSome: grantedFolderIds } }] } })
      : []

    const lowerQ = q.toLowerCase()
    const matchedFolders = visibleFolders.filter(
      f => f.name.toLowerCase().includes(lowerQ) && canStudentSee({ id: f.id, ancestorIds: f.ancestorIds, restrictedToStudentId: f.restrictedToStudentId }, user.id, grantedIds)
    )

    const candidateFolderIds = visibleFolders.map(f => f.id)
    const fileOr = [
      ...(grantedFileIds.length ? [{ id: { in: grantedFileIds } }] : []),
      ...(candidateFolderIds.length ? [{ folderId: { in: candidateFolderIds } }] : []),
    ]
    const candidateFiles = fileOr.length
      ? await prisma.tutorFile.findMany({
          where: { OR: fileOr },
          include: { folder: { select: { id: true, ancestorIds: true, restrictedToStudentId: true } } },
        })
      : []

    const matchedFiles = candidateFiles.filter(file => {
      if (!file.name.toLowerCase().includes(lowerQ)) return false
      // A file has no ancestorIds/restrictedToStudentId of its own —
      // interfaces.md "Правило видимости" requires deriving both from the
      // containing folder (its own id counts as an "ancestor" for a grant
      // placed directly on that folder).
      const ancestorIds = file.folder ? [...file.folder.ancestorIds, file.folder.id] : []
      const restrictedToStudentId = file.folder?.restrictedToStudentId ?? null
      return canStudentSee({ id: file.id, ancestorIds, restrictedToStudentId }, user.id, grantedIds)
    })

    return NextResponse.json({ folders: matchedFolders, files: matchedFiles })
  } catch (e) {
    console.error('[GET /api/tutor-files/search]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
