import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, requireOwnedFolder } from '@/shared/lib/tutorFiles/access'
import { ensureStudentSubfolder, studentsWithAccess } from '@/shared/lib/tutorFiles/storage'
import { isAllowedCover } from '@/shared/lib/tutorFiles/covers'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/tutor-files/folders/[id] {name?, allowStudentUpload?, cover?, submissionDeadline?} — rename,
// set/clear the cover (`preset:<id>` or our own public S3 URL, null = default) and/or
// toggle the G03 "ученики могут сдавать сюда" flag; parent/ancestorIds are
// untouched (moving a folder between parents is out of scope, interfaces.md).
// Turning the flag on backfills a personal subfolder for every student who
// can already see this folder (the grant route only does it for new
// grants), including students who reach it through a grant on an ancestor.
// Turning it off keeps existing subfolders and their files — the
// teacher deletes them explicitly if wanted.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const guard = await requireOwnedFolder(id, user.id)
    if (guard.response) return guard.response

    const body = await req.json().catch(() => ({}))
    const data: { name?: string; allowStudentUpload?: boolean; cover?: string | null; submissionDeadline?: Date | null } = {}
    if (body?.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      data.name = name
    }
    if (typeof body?.allowStudentUpload === 'boolean') {
      if (body.allowStudentUpload && guard.folder.restrictedToStudentId) {
        return NextResponse.json({ error: 'RESTRICTED_PARENT' }, { status: 400 })
      }
      data.allowStudentUpload = body.allowStudentUpload
    }
    // Idea 2: a submissions folder's deadline (uploads after it are marked late).
    if (body?.submissionDeadline !== undefined) {
      if (body.submissionDeadline === null) data.submissionDeadline = null
      else {
        const d = new Date(String(body.submissionDeadline))
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'submissionDeadline must be an ISO date or null' }, { status: 400 })
        data.submissionDeadline = d
      }
    }
    if (body?.cover !== undefined) {
      if (body.cover !== null && (typeof body.cover !== 'string' || !isAllowedCover(body.cover, process.env.NEXT_PUBLIC_S3_PUBLIC_URL))) {
        return NextResponse.json({ error: 'INVALID_COVER' }, { status: 400 })
      }
      data.cover = body.cover
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

    const folder = await prisma.tutorFolder.update({ where: { id }, data })

    if (data.allowStudentUpload && !guard.folder.allowStudentUpload) {
      for (const studentId of await studentsWithAccess(folder)) await ensureStudentSubfolder(folder, studentId)
    }

    return NextResponse.json({ folder })
  } catch (e) {
    console.error('[PATCH /api/tutor-files/folders/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/tutor-files/folders/[id] — cascades to descendant TutorFolder/TutorFile
// rows and every grant on them via the real Postgres `ON DELETE CASCADE` FKs
// on the self-relation and TutorFile.folderId/TutorFolderGrant.folderId/
// TutorFileGrant.fileId (prisma/migrations/20260924190538_add_tutor_files) —
// Postgres applies FK cascade transitively across self-reference levels, so
// one `delete()` is enough; no manual recursive walk needed.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const guard = await requireOwnedFolder(id, user.id)
    if (guard.response) return guard.response

    await prisma.tutorFolder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/tutor-files/folders/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
