import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { fileContentResponse } from '@/shared/lib/tutorFiles/content'
import { findFileVisibleToStudent, getFilesSessionUser, hasStorageAccess, requireOwnedFile, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { getStorageLimits, getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { STORAGE_BILLING_ENABLED } from '@/shared/lib/tutorFiles/billing'
import { extractText, isIndexable } from '@/shared/lib/tutorFiles/extractText'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/tutor-files/files/[id]/content — the raw bytes for the in-app
// viewer (txt/csv/docx/xlsx are parsed client-side). Goes through the API,
// not the public URL, because the bucket's website domain sends no CORS
// headers for fetch(), and so access is checked the same way as everywhere
// else (owner, or a student who can see the file).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const file = user.role === 'TEACHER'
      ? await prisma.tutorFile.findFirst({ where: { id, teacherId: user.id } })
      : await findFileVisibleToStudent(id, user.id)
    if (!file) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return fileContentResponse(file)
  } catch (e) {
    console.error('[GET /api/tutor-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/tutor-files/files/[id]/content — FormData {file}. Replaces the
// bytes of a file the in-browser docx editor already saved "as new" (has
// `derivedFromId` set) — an original is never overwritten this way, only a
// derived copy (spec decision, see .autopilot/tutor-files-reupload-edit).
// Same S3-put-then-write ordering, quota check and content re-indexing as
// POST — old S3 object is left in place (this app never deletes from S3).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const guard = await requireOwnedFile(id, user.id)
    if (guard.response) return guard.response
    const existing = guard.file
    if (!existing.derivedFromId) return NextResponse.json({ error: 'NOT_DERIVED' }, { status: 400 })
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()

    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    const limits = await getStorageLimits()
    if (file.size > limits.maxFileBytes) return NextResponse.json({ error: 'FILE_TOO_LARGE', maxFileBytes: limits.maxFileBytes }, { status: 413 })

    const owner = await getTeacherStorageLimits(user.id)
    const usedByOthers = (await getUsedBytes(user.id)) - existing.sizeBytes
    if ((!STORAGE_BILLING_ENABLED || owner.isAdmin) && usedByOthers + file.size > owner.quotaBytes) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', quotaBytes: owner.quotaBytes }, { status: 413 })
    }

    const ext = existing.name.includes('.') ? existing.name.split('.').pop()!.toLowerCase() : 'bin'
    const key = `tutor-files/${user.id}/${randomUUID()}.${ext}`
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
      console.error('[PATCH /api/tutor-files/files/[id]/content] upload failed', e)
      return NextResponse.json({ error: 'Upload failed, try again' }, { status: 502 })
    }

    const mimeType = file.type || 'application/octet-stream'
    const updated = await prisma.tutorFile.update({
      where: { id },
      data: {
        key, url, sizeBytes: file.size, mimeType,
        ...(isIndexable(existing.name, mimeType) ? {} : { contentText: '' }),
      },
    })

    if (isIndexable(existing.name, mimeType)) {
      const fileName = existing.name
      after(async () => {
        const text = await extractText(buffer, fileName, mimeType)
        await prisma.tutorFile.update({ where: { id }, data: { contentText: text } }).catch(() => {})
      })
    }

    const usedBytes = await getUsedBytes(user.id)
    return NextResponse.json({ file: updated, usedBytes, quotaBytes: owner.quotaBytes })
  } catch (e) {
    console.error('[PATCH /api/tutor-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
