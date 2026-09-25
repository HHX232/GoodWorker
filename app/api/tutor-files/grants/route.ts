import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, hasTeacherStudentLink, requireOwnedFile, requireOwnedFolder } from '@/shared/lib/tutorFiles/access'
import { assertFolderDepthAllowed, assertNotUnderRestrictedFolder, FolderDepthExceededError, RestrictedAncestorError } from '@/shared/lib/tutorFiles/storage'
import { postEventCard } from '@/shared/lib/chat/access'

type ItemType = 'folder' | 'file'

// POST /api/tutor-files/grants {itemType, itemId, studentIds: string[]} — grants
// one folder/file to one or more students in one request (ticket 03, R03).
// Every studentId must be linked to the teacher via TeacherStudent (all
// checked before any write — a single unlinked id fails the whole request
// with 403, not a partial grant). Granting a folder with
// `allowStudentUpload===true` additionally auto-creates (idempotently) the
// student's own restricted "учебная" subfolder — G03 — reusing the same
// assertFolderDepthAllowed/assertNotUnderRestrictedFolder guard ticket 02's
// folder POST route uses, since this is a TutorFolder.create like any other.
// Best-effort chat notification (FILE_ACCESS_GRANTED) fires after grants are
// persisted — interfaces.md "Контракт: уведомление ученика в чате".
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const itemType: ItemType | undefined = body?.itemType === 'folder' || body?.itemType === 'file' ? body.itemType : undefined
    const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
    const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds.filter((s: unknown): s is string => typeof s === 'string') : []

    if (!itemType) return NextResponse.json({ error: 'itemType must be "folder" or "file"' }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
    if (studentIds.length === 0) return NextResponse.json({ error: 'studentIds required' }, { status: 400 })

    const folderGuard = itemType === 'folder' ? await requireOwnedFolder(itemId, user.id) : null
    if (folderGuard?.response) return folderGuard.response
    const fileGuard = itemType === 'file' ? await requireOwnedFile(itemId, user.id) : null
    if (fileGuard?.response) return fileGuard.response
    const folder = folderGuard?.folder
    const file = fileGuard?.file
    const itemName = (folder ?? file)!.name

    // All-or-nothing link check — a request naming one unlinked student must
    // not silently grant the rest (acceptance criterion "Попытка дать
    // доступ ученику, не связанному с репетитором — 403").
    const linkChecks = await Promise.all(studentIds.map(studentId => hasTeacherStudentLink(user.id, studentId)))
    if (linkChecks.some(linked => !linked)) {
      return NextResponse.json({ error: 'One or more students are not linked to this teacher' }, { status: 403 })
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: user.id }, select: { name: true } })
    const teacherName = teacher?.name ?? ''

    for (const studentId of studentIds) {
      if (folder) {
        await prisma.tutorFolderGrant.upsert({
          where: { folderId_studentId: { folderId: folder.id, studentId } },
          create: { folderId: folder.id, studentId },
          update: {},
        })

        if (folder.allowStudentUpload) {
          const existing = await prisma.tutorFolder.findFirst({
            where: { parentId: folder.id, restrictedToStudentId: studentId },
            select: { id: true },
          })
          if (!existing) {
            try {
              assertFolderDepthAllowed(folder.ancestorIds)
              await assertNotUnderRestrictedFolder(folder)
            } catch (e) {
              if (e instanceof FolderDepthExceededError || e instanceof RestrictedAncestorError) {
                // Main grant on `folder` above already succeeded — only the
                // auto subfolder is skipped for this student.
                console.error('[POST /api/tutor-files/grants] auto subfolder skipped', e)
                continue
              }
              throw e
            }

            const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })
            await prisma.$transaction(async tx => {
              const child = await tx.tutorFolder.create({
                data: {
                  teacherId: user.id,
                  parentId: folder.id,
                  name: student?.name ?? 'Ученик',
                  ancestorIds: [...folder.ancestorIds, folder.id],
                  restrictedToStudentId: studentId,
                },
              })
              await tx.tutorFolderGrant.create({ data: { folderId: child.id, studentId } })
            })
          }
        }
      } else if (file) {
        await prisma.tutorFileGrant.upsert({
          where: { fileId_studentId: { fileId: file.id, studentId } },
          create: { fileId: file.id, studentId },
          update: {},
        })
      }
    }

    await Promise.allSettled(
      studentIds.map(studentId =>
        postEventCard({
          teacherId: user.id,
          studentId,
          eventType: 'FILE_ACCESS_GRANTED',
          payload: { itemType, itemName, teacherName },
        }).catch(e => console.error('[POST /api/tutor-files/grants] postEventCard failed', e))
      )
    )

    return NextResponse.json({ ok: true, itemType, itemId, studentIds })
  } catch (e) {
    console.error('[POST /api/tutor-files/grants]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/tutor-files/grants {itemType, itemId, studentId} — revokes one
// grant. Idempotent (deleteMany, no error if already absent). Does not touch
// an auto-created "учебная" subfolder — that is a separate TutorFolder with
// its own grant, unaffected by revoking the parent's grant.
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
