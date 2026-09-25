import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, hasTeacherStudentLink, isTeacherVipActive, requireOwnedFile, requireOwnedFolder, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { ensureSubfoldersForGrant, revokeOrphanedSubfolderGrants } from '@/shared/lib/tutorFiles/storage'
import { postEventCard } from '@/shared/lib/chat/access'

type ItemType = 'folder' | 'file'

// POST /api/tutor-files/grants {itemType, itemId, studentIds: string[]} — grants
// one folder/file to one or more students in one request (ticket 03, R03).
// Every studentId must be linked to the teacher via TeacherStudent (all
// checked before any write — a single unlinked id fails the whole request
// with 403, not a partial grant). Granting a folder with
// `allowStudentUpload===true` — or with such folders below it — additionally
// auto-creates (idempotently) the student's own restricted "учебная"
// subfolders — G03 — via ensureSubfoldersForGrant (storage.ts).
// Best-effort chat notification (FILE_ACCESS_GRANTED) fires after grants are
// persisted — interfaces.md "Контракт: уведомление ученика в чате".
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const itemType: ItemType | undefined = body?.itemType === 'folder' || body?.itemType === 'file' ? body.itemType : undefined
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
    const studentIds: string[] = Array.isArray(body?.studentIds)
      ? [...new Set<string>(body.studentIds.filter((s: unknown): s is string => typeof s === 'string'))]
      : []

    if (!itemType) return NextResponse.json({ error: 'itemType must be "folder" or "file"' }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
    if (studentIds.length === 0) return NextResponse.json({ error: 'studentIds required' }, { status: 400 })
    // Optional access window (idea 5): open from / close after. null clears a bound.
    const parseDate = (v: unknown): Date | null | undefined => {
      if (v === null) return null
      if (typeof v !== 'string') return undefined
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? undefined : d
    }
    const availableFrom = parseDate(body?.availableFrom)
    const availableUntil = parseDate(body?.availableUntil)
    if (availableFrom && availableUntil && availableUntil <= availableFrom) return NextResponse.json({ error: 'availableUntil must be after availableFrom' }, { status: 400 })
    const window = {
      ...(availableFrom !== undefined ? { availableFrom } : {}),
      ...(availableUntil !== undefined ? { availableUntil } : {}),
    }
    if (!(await isTeacherVipActive(user.id))) return vipRequiredResponse()

    const folderGuard = itemType === 'folder' ? await requireOwnedFolder(itemId, user.id) : null
    if (folderGuard?.response) return folderGuard.response
    const fileGuard = itemType === 'file' ? await requireOwnedFile(itemId, user.id) : null
    if (fileGuard?.response) return fileGuard.response
    const folder = folderGuard?.folder
    const file = fileGuard?.file
    const itemName = (folder ?? file)!.name
    // A student's own "учебная" subfolder already belongs to exactly one
    // student — sharing it onward would be invisible anyway (canStudentSee).
    if (folder?.restrictedToStudentId) return NextResponse.json({ error: 'Restricted folder cannot be shared' }, { status: 400 })

    // All-or-nothing link check — a request naming one unlinked student must
    // not silently grant the rest (acceptance criterion "Попытка дать
    // доступ ученику, не связанному с репетитором — 403").
    const linkChecks = await Promise.all(studentIds.map(studentId => hasTeacherStudentLink(user.id, studentId)))
    if (linkChecks.some(linked => !linked)) {
      return NextResponse.json({ error: 'One or more students are not linked to this teacher' }, { status: 403 })
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: user.id }, select: { name: true } })
    const teacherName = teacher?.name ?? ''

    // Only students who didn't already hold this grant get the chat card — a
    // repeat "share" must not spam the conversation (R03i.3: notify about
    // *new* access).
    const newlyGranted: string[] = []
    for (const studentId of studentIds) {
      if (folder) {
        const existed = await prisma.tutorFolderGrant.findUnique({ where: { folderId_studentId: { folderId: folder.id, studentId } }, select: { studentId: true } })
        if (!existed) {
          await prisma.tutorFolderGrant.create({ data: { folderId: folder.id, studentId, ...window } })
          newlyGranted.push(studentId)
        } else if (Object.keys(window).length) {
          await prisma.tutorFolderGrant.update({ where: { folderId_studentId: { folderId: folder.id, studentId } }, data: window })
        }
        await ensureSubfoldersForGrant(folder, studentId, window)
      } else if (file) {
        const existed = await prisma.tutorFileGrant.findUnique({ where: { fileId_studentId: { fileId: file.id, studentId } }, select: { studentId: true } })
        if (!existed) {
          await prisma.tutorFileGrant.create({ data: { fileId: file.id, studentId, ...window } })
          newlyGranted.push(studentId)
        } else if (Object.keys(window).length) {
          await prisma.tutorFileGrant.update({ where: { fileId_studentId: { fileId: file.id, studentId } }, data: window })
        }
      }
    }

    await Promise.allSettled(
      newlyGranted.map(studentId =>
        postEventCard({
          teacherId: user.id,
          studentId,
          eventType: 'FILE_ACCESS_GRANTED',
          // availableFrom in the future → the card says when it opens.
          payload: { itemType, itemName, teacherName, availableFrom: availableFrom && availableFrom > new Date() ? availableFrom.toISOString() : null },
        }).catch(e => console.error('[POST /api/tutor-files/grants] postEventCard failed', e))
      )
    )

    return NextResponse.json({ ok: true, itemType, itemId, studentIds })
  } catch (e) {
    console.error('[POST /api/tutor-files/grants]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET /api/tutor-files/grants?itemType=folder|file&itemId=... — who currently
// holds a direct grant on the item (ShareAccessModal's "already has access"
// list, ticket 06). Direct grants only: access inherited from an ancestor is
// revoked on that ancestor, not here.
export async function GET(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const itemType = req.nextUrl.searchParams.get('itemType')
    const itemId = req.nextUrl.searchParams.get('itemId') ?? ''
    if (itemType !== 'folder' && itemType !== 'file') return NextResponse.json({ error: 'itemType must be "folder" or "file"' }, { status: 400 })

    const studentSelect = { select: { id: true, name: true, avatarUrl: true } }
    if (itemType === 'folder') {
      const guard = await requireOwnedFolder(itemId, user.id)
      if (guard.response) return guard.response
      const grants = await prisma.tutorFolderGrant.findMany({ where: { folderId: itemId }, include: { student: studentSelect }, orderBy: { grantedAt: 'asc' } })
      return NextResponse.json({ students: grants.map(g => ({ ...g.student, grantedAt: g.grantedAt, availableFrom: g.availableFrom, availableUntil: g.availableUntil })) })
    }
    const guard = await requireOwnedFile(itemId, user.id)
    if (guard.response) return guard.response
    const grants = await prisma.tutorFileGrant.findMany({ where: { fileId: itemId }, include: { student: studentSelect }, orderBy: { grantedAt: 'asc' } })
    return NextResponse.json({ students: grants.map(g => ({ ...g.student, grantedAt: g.grantedAt, availableFrom: g.availableFrom, availableUntil: g.availableUntil })) })
  } catch (e) {
    console.error('[GET /api/tutor-files/grants]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/tutor-files/grants {itemType, itemId, studentId} — revokes one
// grant. Idempotent (deleteMany, no error if already absent). Revoking a
// folder also revokes the student's grants on their own "учебная" subfolders
// in that branch they can no longer reach (revokeOrphanedSubfolderGrants) —
// the subfolders and their files stay for the teacher to review.
export async function DELETE(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const itemType: ItemType | undefined = body?.itemType === 'folder' || body?.itemType === 'file' ? body.itemType : undefined
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
    const studentId = typeof body?.studentId === 'string' ? body.studentId : ''

    if (!itemType) return NextResponse.json({ error: 'itemType must be "folder" or "file"' }, { status: 400 })
    if (!itemId || !studentId) return NextResponse.json({ error: 'itemId and studentId required' }, { status: 400 })

    if (itemType === 'folder') {
      const guard = await requireOwnedFolder(itemId, user.id)
      if (guard.response) return guard.response
      await prisma.tutorFolderGrant.deleteMany({ where: { folderId: itemId, studentId } })
      await revokeOrphanedSubfolderGrants(itemId, studentId)
    } else {
      const guard = await requireOwnedFile(itemId, user.id)
      if (guard.response) return guard.response
      await prisma.tutorFileGrant.deleteMany({ where: { fileId: itemId, studentId } })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/tutor-files/grants]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
