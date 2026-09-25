import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, requireOwnedFolder } from '@/shared/lib/tutorFiles/access'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/tutor-files/folders/[id] {name} — rename only; parent/ancestorIds are
// untouched (moving a folder between parents is out of scope, interfaces.md).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const guard = await requireOwnedFolder(id, user.id)
    if (guard.response) return guard.response

    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const folder = await prisma.tutorFolder.update({ where: { id }, data: { name } })
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
