import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/student-files/files/[id]/download — a real download of any size,
// streamed through our API. Never the bucket's public URL: browsers' Safe
// Browsing flags that domain as dangerous. Always an attachment, never
// rendered inline (a student-uploaded .html must not run on our origin).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const file = await prisma.studentFile.findFirst({ where: { id, studentId } })
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.key }))
    if (!object.Body) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const stream = object.Body.transformToWebStream()
    const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        ...(object.ContentLength ? { 'Content-Length': String(object.ContentLength) } : {}),
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[GET /api/student-files/files/[id]/download]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
