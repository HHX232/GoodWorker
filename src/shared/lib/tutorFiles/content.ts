import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'

/** Text/docx/xlsx are rendered in the browser; bigger files just download. */
const MAX_INLINE_BYTES = 20 * 1024 * 1024

/**
 * The bytes of a library file for the in-app viewer, after the caller has
 * checked access. Never served with the uploaded MIME type: a student-uploaded
 * .html opened straight from this URL would otherwise run on our origin — the
 * viewer reads the bytes via fetch(), so the type doesn't matter.
 */
export async function fileContentResponse(file: { key: string; sizeBytes: number }): Promise<NextResponse> {
  if (file.sizeBytes > MAX_INLINE_BYTES) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
  const bytes = await object.Body?.transformToByteArray()
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment',
      'Content-Security-Policy': 'sandbox',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
