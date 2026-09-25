import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { findFileVisibleToStudent, getFilesSessionUser } from '@/shared/lib/tutorFiles/access'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

/** Text/docx/xlsx are rendered in the browser; bigger files just download. */
const MAX_INLINE_BYTES = 20 * 1024 * 1024

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
    if (file.sizeBytes > MAX_INLINE_BYTES) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })

    const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
    const bytes = await object.Body?.transformToByteArray()
    if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return new NextResponse(Buffer.from(bytes), {
      // Never served with the uploaded MIME type: a student-uploaded .html
      // opened straight from this URL would otherwise run on our origin.
      // The viewer reads the bytes via fetch(), so the type doesn't matter.
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment',
        'Content-Security-Policy': 'sandbox',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error('[GET /api/tutor-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
