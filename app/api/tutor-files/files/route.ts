import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { activeGrantWhere, canStudentSee, getFilesSessionUser, hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { getStorageLimits, getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { STORAGE_BILLING_ENABLED } from '@/shared/lib/tutorFiles/billing'
import { postEventCard } from '@/shared/lib/chat/access'
import { extractText, isIndexable } from '@/shared/lib/tutorFiles/extractText'

export const runtime = 'nodejs'

// Limits come from the admin-editable StorageSettings. With billing (Wallet
// build) uploads past the quota are allowed and billed monthly — the UI shows
// an informational modal from the returned usedBytes/quotaBytes; without it
// (main) the quota is a hard cap and the upload is refused up front.
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
    const limits = await getStorageLimits() // per-file cap is the same for everyone; the quota is per owner below
    if (file.size > limits.maxFileBytes) return NextResponse.json({ error: 'FILE_TOO_LARGE', maxFileBytes: limits.maxFileBytes }, { status: 413 })

    const folderId = (formData.get('folderId') as string | null) || null
    const folder = folderId ? await prisma.tutorFolder.findUnique({ where: { id: folderId } }) : null
    if (folderId && !folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // The library owner the row (and the quota) belongs to — the teacher
    // themselves, or, for a student, the teacher who owns their subfolder.
    let teacherId: string
    if (user.role === 'TEACHER') {
      if (folder && folder.teacherId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()
      teacherId = user.id
    } else {
      // G03.2: a student uploads only into their own "учебная" subfolder, and
      // only while they still hold access to it.
      if (!folder || folder.restrictedToStudentId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const grants = await prisma.tutorFolderGrant.findMany({
        where: { studentId: user.id, folderId: { in: [folder.id, ...folder.ancestorIds] }, ...activeGrantWhere() },
        select: { folderId: true },
      })
      if (!canStudentSee(folder, user.id, new Set(grants.map(g => g.folderId)))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      teacherId = folder.teacherId
    }

    // Student submissions count toward their tutor's library, like everything in it.
    // Admin libraries are always hard-capped (ADMIN_QUOTA_GB, never billed).
    const owner = await getTeacherStorageLimits(teacherId)
    if ((!STORAGE_BILLING_ENABLED || owner.isAdmin) && (await getUsedBytes(teacherId)) + file.size > owner.quotaBytes) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', quotaBytes: owner.quotaBytes }, { status: 413 })
    }

    const ext = extOf(file.name) || 'bin'
    const key = `tutor-files/${teacherId}/${randomUUID()}.${ext}`
    let url: string
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
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
        // Not searchable inside (media, archives…): '' marks it as done, so the admin reindex never counts it.
        ...(isIndexable(file.name, file.type || 'application/octet-stream') ? {} : { contentText: '' }),
      },
    })

    // Idea 8: index the text for search inside files — after the response,
    // so a big PDF never slows the upload down.
    const fileName = file.name
    const mime = created.mimeType
    if (isIndexable(fileName, mime)) {
      after(async () => {
        const text = await extractText(buffer, fileName, mime)
        await prisma.tutorFile.update({ where: { id: created.id }, data: { contentText: text } }).catch(() => {})
      })
    }

    // usedBytes is the teacher's own quota figure — not the student's business.
    if (user.role === 'STUDENT') {
      // Idea 2: tell the tutor in chat (best-effort), flagging a late hand-in.
      const dropbox = folder?.parentId ? await prisma.tutorFolder.findUnique({ where: { id: folder.parentId }, select: { name: true, submissionDeadline: true } }) : null
      const late = !!dropbox?.submissionDeadline && created.createdAt > dropbox.submissionDeadline
      postEventCard({
        teacherId,
        studentId: user.id,
        senderRole: 'STUDENT',
        eventType: 'FILE_SUBMITTED',
        payload: { fileName: created.name, folderName: dropbox?.name ?? folder?.name ?? '', folderId: folder?.id ?? null, late },
      }).catch(e => console.error('[POST /api/tutor-files/files] submission card failed', e))
      return NextResponse.json({ file: created })
    }
    const usedBytes = await getUsedBytes(teacherId)
    return NextResponse.json({ file: created, usedBytes, quotaBytes: owner.quotaBytes })
  } catch (e) {
    console.error('[POST /api/tutor-files/files]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
