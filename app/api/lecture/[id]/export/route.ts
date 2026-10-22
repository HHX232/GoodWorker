import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { lectureToDocx, photoIdsIn, type DocxPhoto } from '@/shared/lib/lecture/docx'
import { readObject } from '@/shared/lib/lecture/audio'
import { saveLectureAudioFile } from '@/shared/lib/lecture/audioFile'
import type { PMNode } from '@/shared/lib/lecture/markdownToDoc'
import { parseContext } from '@/shared/lib/lecture/context'
import { studentSubjectFolder, tutorSubjectFolder } from '@/shared/lib/lecture/subjects'
import { DriveError, driveErrorResponse, ensureLecturesFolder, isStudentVipActive } from '@/shared/lib/studentDrive/drive'
import { hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { CALL_NOTES_FOLDER, DOCX_MIME, ensureTutorRootFolder, fileName, saveLectureDocx } from '@/shared/lib/lecture/saveToFiles'

export const runtime = 'nodejs'
export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

const LECTURES_FOLDER = 'Конспекты лекций'

async function ownerName(ownerId: string, role: 'STUDENT' | 'TEACHER'): Promise<string> {
  const row = role === 'STUDENT'
    ? await prisma.student.findUnique({ where: { id: ownerId }, select: { name: true } })
    : await prisma.teacher.findUnique({ where: { id: ownerId }, select: { name: true } })
  return row?.name ?? 'GoodWorker'
}

/**
 * "Сохранять аудио" on → the recording goes next to the .docx as .m4a. Gluing a long
 * lecture takes a while, so it runs after the response; the client just says it's coming.
 */
function saveAudioAfter(lectureId: string, owner: { id: string; role: 'STUDENT' | 'TEACHER' }, folderId: string | null, docxName: string, keepAudio: boolean, lang: string): 'pending' | null {
  if (!keepAudio) return null
  after(async () => {
    try {
      await saveLectureAudioFile({ lectureId, owner, folderId, baseName: docxName.replace(/\.docx$/i, ''), lang })
    } catch (e) {
      console.error('[lecture export] audio file failed', lectureId, e)
    }
  })
  return 'pending'
}

// POST /api/lecture/[id]/export — {save?: boolean}. Builds the .docx from the
// last autosaved doc. save=false → download. save=true → into the owner's
// storage (student: own drive; tutor: own library), tagged with the lecture
// so opening it returns to the lecture editor; saving again overwrites that file.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const { lecture, user } = guard
    const body = await req.json().catch(() => ({}))

    const name = fileName(lecture.title, lecture.createdAt)
    const doc = lecture.docJson as unknown as PMNode | null
    const photoRows = await prisma.lecturePhoto.findMany({ where: { lectureId: id, id: { in: photoIdsIn(doc) } } })
    const photos = new Map<string, DocxPhoto>()
    for (const p of photoRows) {
      const data = await readObject(p.key).catch(() => null)
      if (data) photos.set(p.id, { bytes: data, width: p.width, height: p.height, mime: p.mimeType })
    }
    const bytes = await lectureToDocx(doc, lecture.title || name.replace(/\.docx$/, ''), await ownerName(user.id, user.role), photos)

    if (body.save !== true) {
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': DOCX_MIME,
          'Content-Disposition': `attachment; filename="lecture.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    // Filed by subject: «Конспекты лекций/<Предмет>» (see subjects.ts). Call notes go to
    // «Конспекты уроков» and need no VIP — every participant got a copy (quota as usual).
    const subject = parseContext(lecture.context).subject
    const isCall = !!lecture.callRoomId
    const rootName = isCall ? CALL_NOTES_FOLDER : LECTURES_FOLDER

    if (user.role === 'STUDENT') {
      if (!isCall && !user.isAdmin && !(await isStudentVipActive(user.id))) return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })
    } else if (!isCall && !(await hasStorageAccess(user.id))) return vipRequiredResponse()

    const root = user.role === 'STUDENT' ? await ensureLecturesFolder(user.id, rootName) : await ensureTutorRootFolder(user.id, rootName)
    const target = user.role === 'STUDENT' ? await studentSubjectFolder(user.id, root, subject) : await tutorSubjectFolder(user.id, root, subject)
    const file = await saveLectureDocx({ lecture, ownerId: user.id, role: user.role, folderId: target, bytes, name })
    // Saved before the subject was known → still in the root: move it (and its audio) in.
    if (!file.created && file.folderId === root && target !== root) {
      if (user.role === 'STUDENT') await prisma.studentFile.updateMany({ where: { studentId: user.id, lectureNoteId: id, folderId: root }, data: { folderId: target } })
      else await prisma.tutorFile.updateMany({ where: { teacherId: user.id, lectureNoteId: id, folderId: root }, data: { folderId: target } })
      file.folderId = target
    }
    const audio = saveAudioAfter(id, { id: user.id, role: user.role }, file.folderId, file.name, lecture.keepAudio, req.cookies.get('NEXT_LOCALE')?.value ?? 'ru')
    return NextResponse.json({ file: { id: file.fileId, name: file.name, folderId: file.folderId }, where: user.role === 'STUDENT' ? 'drive' : 'library', audio })
  } catch (e) {
    if (e instanceof DriveError) return driveErrorResponse(e)
    console.error('[POST /api/lecture/[id]/export]', e)
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 })
  }
}
