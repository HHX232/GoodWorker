import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'

export const runtime = 'nodejs'

// GET /api/admin/verifications/doc?kind=experience&id=<experienceId>&i=<n>
// GET /api/admin/verifications/doc?kind=passport&id=<teacherId>
// A verification document streamed through our API for the admin page —
// never the bucket's public URL: browsers' Safe Browsing flags that domain
// as dangerous. The file is looked up by id (no arbitrary URLs — not an open
// proxy). Images and PDFs open inline, anything else downloads.
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif)|application\/pdf)$/i

function keyFromPublicUrl(url: string): string | null {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL?.replace(/\/$/, '')
  if (base && url.startsWith(`${base}/`)) return decodeURIComponent(url.slice(base.length + 1))
  try {
    // Older rows may carry another host of the same bucket: the key is the path.
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  const kind = req.nextUrl.searchParams.get('kind')
  const id = req.nextUrl.searchParams.get('id') ?? ''
  try {
    let url: string | null | undefined = null
    if (kind === 'experience') {
      const exp = await prisma.teacherExperience.findUnique({ where: { id }, select: { documentUrls: true } })
      url = exp?.documentUrls[Number(req.nextUrl.searchParams.get('i') ?? 0)]
    } else if (kind === 'passport') {
      url = (await prisma.teacher.findUnique({ where: { id }, select: { passportDocumentUrl: true } }))?.passportDocumentUrl
    }
    const key = url ? keyFromPublicUrl(url) : null
    if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    if (!object.Body) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const type = object.ContentType ?? ''
    const inline = INLINE.test(type)
    const name = key.split('/').pop() ?? 'document'
    return new NextResponse(object.Body.transformToWebStream(), {
      headers: {
        'Content-Type': inline ? type : 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"`,
        ...(object.ContentLength ? { 'Content-Length': String(object.ContentLength) } : {}),
        // Chrome's PDF viewer refuses to run in a sandboxed document; images and downloads keep the sandbox.
        ...(type.toLowerCase() === 'application/pdf' ? {} : { 'Content-Security-Policy': 'sandbox' }),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    console.error('[GET /api/admin/verifications/doc]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
