import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { publicUrlForKey, s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { getFilesSessionUser, hasStorageAccess, vipRequiredResponse } from '@/shared/lib/tutorFiles/access'
import { getStorageLimits, getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'
import { STORAGE_BILLING_ENABLED } from '@/shared/lib/tutorFiles/billing'
import { extractText } from '@/shared/lib/tutorFiles/extractText'
import { clampPageCount, coverProblem, defaultSpineColor, deleteS3Objects, loadBooksFor, MAX_BOOK_TITLE, parseCoverKind, parseSpineColor, toBook, uploadBookCover } from '@/shared/lib/tutorFiles/books'

export const runtime = 'nodejs'

// GET /api/tutor-files/books — every book the viewer sees (tutor: own; student:
// with an active grant). → { books: LibraryBook[] }
export async function GET() {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ books: await loadBooksFor(user) })
  } catch (e) {
    console.error('[GET /api/tutor-files/books]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/tutor-files/books — FormData {file (PDF), cover? (PNG/JPEG, ready 2:3),
// coverKind? (found|page1|photo), spineColor? (#RRGGBB), title?, pageCount?}.
// Tutor only, root of the library (folderId=null). Same VIP / per-file limit /
// quota checks and error codes as POST /files (VIP_REQUIRED, FILE_TOO_LARGE,
// QUOTA_EXCEEDED, 502). The cover is not counted in the quota (≤ 5 MB, one per book).
// → { book, usedBytes, quotaBytes }
export async function POST(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    const limits = await getStorageLimits()
    if (file.size > limits.maxFileBytes) return NextResponse.json({ error: 'FILE_TOO_LARGE', maxFileBytes: limits.maxFileBytes }, { status: 413 })
    if (!(await hasStorageAccess(user.id))) return vipRequiredResponse()

    const rawCover = formData.get('cover')
    const cover = rawCover instanceof File && rawCover.size > 0 ? rawCover : null
    if (cover) {
      const problem = coverProblem(cover)
      if (problem) return NextResponse.json({ error: problem }, { status: problem === 'COVER_TOO_LARGE' ? 413 : 400 })
    }
    const coverKind = cover ? parseCoverKind(formData.get('coverKind')) : null
    if (cover && !coverKind) return NextResponse.json({ error: 'coverKind must be found, page1 or photo' }, { status: 400 })

    const owner = await getTeacherStorageLimits(user.id)
    if ((!STORAGE_BILLING_ENABLED || owner.isAdmin) && (await getUsedBytes(user.id)) + file.size > owner.quotaBytes) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', quotaBytes: owner.quotaBytes }, { status: 413 })
    }

    // Only PDFs are books (the reader is pdf.js): trust the bytes, not the browser's MIME.
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!buffer.subarray(0, 1024).includes('%PDF')) return NextResponse.json({ error: 'NOT_PDF' }, { status: 400 })

    const rawTitle = formData.get('title')
    const title = (typeof rawTitle === 'string' ? rawTitle.trim() : '').slice(0, MAX_BOOK_TITLE) || file.name.replace(/\.pdf$/i, '').slice(0, MAX_BOOK_TITLE)
    const spineColor = parseSpineColor(formData.get('spineColor')) ?? defaultSpineColor(title)
    const pageCountRaw = formData.get('pageCount')
    const pageCount = typeof pageCountRaw === 'string' && pageCountRaw !== '' ? clampPageCount(pageCountRaw) : null

    const key = `tutor-files/${user.id}/${randomUUID()}.pdf`
    const uploadedKeys: string[] = [] // objects put by THIS request — removed again if the request fails before the row exists
    let url: string
    let coverUrl: string | null = null
    try {
      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: 'application/pdf', ACL: 'public-read' }))
      uploadedKeys.push(key)
      url = publicUrlForKey(key)
      if (cover) {
        const uploaded = await uploadBookCover(user.id, cover)
        uploadedKeys.push(uploaded.key)
        coverUrl = uploaded.url
      }
    } catch (e) {
      console.error('[POST /api/tutor-files/books] upload failed', e)
      await deleteS3Objects(uploadedKeys)
      return NextResponse.json({ error: 'Upload failed, try again' }, { status: 502 })
    }

    // Write only after S3 succeeded — a failed upload never leaves a half-created row,
    // and a failed write never leaves orphaned objects.
    let created
    try {
      created = await prisma.tutorFile.create({
        data: {
          teacherId: user.id,
          folderId: null,
          name: file.name,
          key,
          url,
          sizeBytes: file.size,
          mimeType: 'application/pdf',
          uploadedByRole: 'TEACHER',
          uploadedById: user.id,
          isBook: true,
          bookTitle: title,
          pageCount,
          coverUrl,
          coverKind,
          spineColor,
        },
      })
    } catch (e) {
      await deleteS3Objects(uploadedKeys)
      throw e
    }

    // Search inside files: index the text after the response, as POST /files does.
    after(async () => {
      const text = await extractText(buffer, file.name, 'application/pdf')
      await prisma.tutorFile.update({ where: { id: created.id }, data: { contentText: text } }).catch(() => {})
    })

    const teacher = await prisma.teacher.findUnique({ where: { id: user.id }, select: { name: true } })
    const book = toBook(created, { teacherName: teacher?.name ?? '', saved: false, progress: null, sharedWith: [] })
    return NextResponse.json({ book, usedBytes: await getUsedBytes(user.id), quotaBytes: owner.quotaBytes })
  } catch (e) {
    console.error('[POST /api/tutor-files/books]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
