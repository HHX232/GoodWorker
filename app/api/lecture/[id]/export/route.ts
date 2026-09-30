import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { lectureToDocx, photoIdsIn, type DocxPhoto } from '@/shared/lib/lecture/docx'
import { readObject } from '@/shared/lib/lecture/audio'
import { saveLectureAudioFile } from '@/shared/lib/lecture/audioFile'
import type { PMNode } from '@/shared/lib/lecture/markdownToDoc'
import { parseContext } from '@/shared/lib/lecture/context'
import { studentSubjectFolder, tutorSubjectFolder } from '@/shared/lib/lecture/subjects'
import { DriveError, driveErrorResponse, ensureLecturesFolder, isStudentVipActive, putStudentFile, replaceStudentFile } from '@/shared/lib/studentDrive/drive'
import { hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { extractText } from '@/shared/lib/tutorFiles/extractText'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'

export const runtime = 'nodejs'
export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const LECTURES_FOLDER = 'Конспекты лекций'

function fileName(title: string, createdAt: Date): string {
  const base = (title || `Лекция ${createdAt.toISOString().slice(0, 10)}`).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 120)
  return `${base || 'Лекция'}.docx`
}

async function ownerName(ownerId: string, role: 'STUDENT' | 'TEACHER'): Promise<string> {
  const row = role === 'STUDENT'
    ? await prisma.student.findUnique({ where: { id: ownerId }, select: { name: true } })
    : await prisma.teacher.findUnique({ where: { id: ownerId }, select: { name: true } })
  return row?.name ?? 'GoodWorker'
}

/** Tutor side: the root "Конспекты лекций" folder of their library. */
async function ensureTutorLecturesFolder(teacherId: string): Promise<string> {
  const existing = await prisma.tutorFolder.findFirst({ where: { teacherId, parentId: null, name: LECTURES_FOLDER }, select: { id: true } })
  if (existing) return existing.id
  return (await prisma.tutorFolder.create({ data: { teacherId, name: LECTURES_FOLDER } })).id
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

    // Filed by subject: «Конспекты лекций/<Предмет>» (see subjects.ts).
    const subject = parseContext(lecture.context).subject

    if (user.role === 'STUDENT') {
      if (!user.isAdmin && !(await isStudentVipActive(user.id))) return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })
      const existing = lecture.fileId ? await prisma.studentFile.findFirst({ where: { id: lecture.fileId, studentId: user.id } }) : null
      const root = await ensureLecturesFolder(user.id, LECTURES_FOLDER)
      const target = await studentSubjectFolder(user.id, root, subject)
      let file = existing
        ? await replaceStudentFile(existing, bytes, DOCX_MIME)
        : await putStudentFile({ studentId: user.id, folderId: target, name, mimeType: DOCX_MIME, bytes, lectureNoteId: id })
      // Saved before the subject was known → still in the root: move it (and its audio) in.
      if (existing && file.folderId === root && target !== root) {
        await prisma.studentFile.updateMany({ where: { studentId: user.id, lectureNoteId: id, folderId: root }, data: { folderId: target } })
        file = { ...file, folderId: target }
      }
      if (!existing) await prisma.lectureNote.update({ where: { id }, data: { fileId: file.id } })
      const audio = saveAudioAfter(id, { id: user.id, role: 'STUDENT' }, file.folderId, file.name, lecture.keepAudio, req.cookies.get('NEXT_LOCALE')?.value ?? 'ru')
      return NextResponse.json({ file: { id: file.id, name: file.name, folderId: file.folderId }, where: 'drive', audio })
    }

    // Tutor (or admin): their library, their quota.
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()
    const existing = lecture.fileId ? await prisma.tutorFile.findFirst({ where: { id: lecture.fileId, teacherId: user.id } }) : null
    const limits = await getTeacherStorageLimits(user.id)
    if ((await getUsedBytes(user.id)) - (existing?.sizeBytes ?? 0) + bytes.length > limits.quotaBytes) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 413 })
    const key = `tutor-files/${user.id}/${randomUUID()}.docx`
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: bytes, ContentType: DOCX_MIME, ACL: 'public-read' }))
    const data = { key, url: publicUrlForKey(key), sizeBytes: bytes.length, mimeType: DOCX_MIME, contentText: null }
    const root = await ensureTutorLecturesFolder(user.id)
    const target = await tutorSubjectFolder(user.id, root, subject)
    let file = existing
      ? await prisma.tutorFile.update({ where: { id: existing.id }, data })
      : await prisma.tutorFile.create({
          data: { ...data, teacherId: user.id, folderId: target, name, uploadedByRole: 'TEACHER', uploadedById: user.id, lectureNoteId: id },
        })
    if (existing && file.folderId === root && target !== root) {
      await prisma.tutorFile.updateMany({ where: { teacherId: user.id, lectureNoteId: id, folderId: root }, data: { folderId: target } })
      file = { ...file, folderId: target }
    }
    if (!existing) await prisma.lectureNote.update({ where: { id }, data: { fileId: file.id } })
    // Search inside files (same as uploads) — after the response.
    after(async () => {
      const text = await extractText(bytes, name, DOCX_MIME)
      await prisma.tutorFile.update({ where: { id: file.id }, data: { contentText: text } }).catch(() => {})
    })
    const audio = saveAudioAfter(id, { id: user.id, role: 'TEACHER' }, file.folderId, file.name, lecture.keepAudio, req.cookies.get('NEXT_LOCALE')?.value ?? 'ru')
    return NextResponse.json({ file: { id: file.id, name: file.name, folderId: file.folderId }, where: 'library', audio })
  } catch (e) {
    if (e instanceof DriveError) return driveErrorResponse(e)
    console.error('[POST /api/lecture/[id]/export]', e)
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 })
  }
}
