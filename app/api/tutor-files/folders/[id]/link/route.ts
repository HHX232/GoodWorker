import { prisma } from '@/shared/prisma/prisma'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, hasStorageAccess, requireOwnedFolder, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'

// POST /api/tutor-files/folders/[id]/link -> {token, name, itemCount} — the
// folder's attach-by-link token (created once, then reused), for putting a
// whole folder into homework / posts / tests / courses.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const guard = await requireOwnedFolder(id, user.id)
    if (guard.response) return guard.response
    if (guard.folder.restrictedToStudentId) return NextResponse.json({ error: 'RESTRICTED_PARENT' }, { status: 400 })
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()

    const link = await prisma.tutorFolderLink.upsert({
      where: { folderId: id },
      create: { folderId: id, token: randomBytes(18).toString('base64url') },
      update: {},
    })
    const itemCount = await prisma.tutorFile.count({ where: { OR: [{ folderId: id }, { folder: { ancestorIds: { has: id }, restrictedToStudentId: null } }] } })
    return NextResponse.json({ token: link.token, name: guard.folder.name, itemCount })
  } catch (e) {
    console.error('[POST /api/tutor-files/folders/[id]/link]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
