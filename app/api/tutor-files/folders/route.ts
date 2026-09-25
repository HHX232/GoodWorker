import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { assertFolderDepthAllowed, assertNotUnderRestrictedFolder, FolderDepthExceededError, RestrictedAncestorError } from '@/shared/lib/tutorFiles/storage'

// POST /api/tutor-files/folders {name, parentId?} — creates a TutorFolder for the
// current teacher. `ancestorIds` is computed once from the parent
// (`[...parent.ancestorIds, parent.id]`) and never recomputed later
// (interfaces.md "Правило видимости"). Root folders (no parentId) have
// `ancestorIds: []`.
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const parentId = typeof body?.parentId === 'string' ? body.parentId : null
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()

    let ancestorIds: string[] = []
    if (parentId) {
      const parent = await prisma.tutorFolder.findUnique({ where: { id: parentId } })
      if (!parent || parent.teacherId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      try {
        assertFolderDepthAllowed(parent.ancestorIds)
        await assertNotUnderRestrictedFolder(parent)
      } catch (e) {
        if (e instanceof FolderDepthExceededError) return NextResponse.json({ error: 'MAX_DEPTH', message: e.message }, { status: 400 })
        if (e instanceof RestrictedAncestorError) {
          return NextResponse.json({ error: 'RESTRICTED_PARENT', message: e.message }, { status: 400 })
        }
        throw e
      }

      ancestorIds = [...parent.ancestorIds, parent.id]
    }

    const folder = await prisma.tutorFolder.create({
      data: { teacherId: user.id, name, parentId, ancestorIds },
    })

    return NextResponse.json({ folder })
  } catch (e) {
    console.error('[POST /api/tutor-files/folders]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
