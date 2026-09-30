import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, requireOwnedFile } from '@/shared/lib/tutorFiles/access'

interface Params {
  params: Promise<{ id: string }>
}

// DELETE /api/tutor-files/files/[id] — deletes the file row; its TutorFileGrant
// rows cascade via the real Postgres FK (`ON DELETE CASCADE` on
// TutorFileGrant.fileId, prisma/migrations/20260924190538_add_tutor_files) —
// no dangling grant is left behind (R08i.1). The S3 object itself is left in
// place (out of scope — same as the rest of the app's uploaders, which never
// delete from S3 either).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (user.role === 'TEACHER') {
      const guard = await requireOwnedFile(id, user.id)
      if (guard.response) return guard.response
    } else {
      // A student may take back only a file they uploaded themselves into
      // their own subfolder (e.g. a wrong submission).
      const file = await prisma.tutorFile.findUnique({ where: { id }, include: { folder: { select: { restrictedToStudentId: true } } } })
      if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (file.uploadedByRole !== 'STUDENT' || file.uploadedById !== user.id || file.folder?.restrictedToStudentId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await prisma.tutorFile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/tutor-files/files/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
