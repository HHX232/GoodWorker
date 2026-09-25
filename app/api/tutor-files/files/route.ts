import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { canStudentSee, getFilesSessionUser, isTeacherVipActive, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { getUsedBytes } from '@/shared/lib/tutorFiles/storage'

export const runtime = 'nodejs'

// Same cap as app/api/upload/route.ts (kept in sync by eye, that route has no
// exported constant to import) — this quota gate is separate and deliberately
// not enforced here (G02: uploads past QUOTA_BYTES are allowed, the UI shows
// an informational modal from the `usedBytes` this route returns).
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

function extOf(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// POST /api/tutor-files/files — FormData {file, folderId?}. Teacher: any own
// folder or the root. Student: only their own "учебная" subfolder (G03.2). Uploads straight to S3
// (same PutObjectCommand/publicUrlForKey path as app/api/upload/route.ts and
// uploadFilesToS3.ts, folder: 'tutor-files' — that route itself is untouched,
// interfaces.md "не менять app/api/upload/route.ts") and writes a TutorFile
// row. Returns {file, usedBytes} — usedBytes recomputed *after* the write
// (interfaces.md "Контракт между тикетами: квота").
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })

    const folderId = (formData.get('folderId') as string | null) || null
    const folder = folderId ? await prisma.tutorFolder.findUnique({ where: { id: folderId } }) : null
    if (folderId && !folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // The library owner the row (and the quota) belongs to — the teacher
    // themselves, or, for a student, the teacher who owns their subfolder.
    let teacherId: string
    if (user.role === 'TEACHER') {
      if (folder && folder.teacherId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (!(await isTeacherVipActive(user.id))) return vipRequiredResponse()
      teacherId = user.id
    } else {
      // G03.2: a student uploads only into their own "учебная" subfolder, and
      // only while they still hold access to it.
      if (!folder || folder.restrictedToStudentId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const grants = await prisma.tutorFolderGrant.findMany({
        where: { studentId: user.id, folderId: { in: [folder.id, ...folder.ancestorIds] } },
        select: { folderId: true },
      })
      if (!canStudentSee(folder, user.id, new Set(grants.map(g => g.folderId)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      teacherId = folder.teacherId
    }

    const ext = extOf(file.name) || 'bin'
    const key = `tutor-files/${teacherId}/${randomUUID()}.${ext}`
    let url: string
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ACL: 'public-read',
      }))
      url = publicUrlForKey(key)
    } catch (e) {
      console.error('[POST /api/tutor-files/files] upload failed', e)
      return NextResponse.json({ error: 'Upload failed, try again' }, { status: 502 })
    }

    // Write only after the S3 put succeeded — a failed upload never leaves a
    // half-created TutorFile row (R01i.1).
    const created = await prisma.tutorFile.create({
      data: {
        teacherId,
        folderId,
        name: file.name,
        key,
        url,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedByRole: user.role,
        uploadedById: user.id,
      },
    })

    // usedBytes is the teacher's own quota figure — not the student's business.
    if (user.role === 'STUDENT') return NextResponse.json({ file: created })
    const usedBytes = await getUsedBytes(teacherId)
    return NextResponse.json({ file: created, usedBytes })
  } catch (e) {
    console.error('[POST /api/tutor-files/files]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
