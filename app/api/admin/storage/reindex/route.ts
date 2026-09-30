import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { s3, S3_BUCKET } from '@/shared/s3/s3Client'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { extractText, isIndexable } from '@/shared/lib/tutorFiles/extractText'

export const runtime = 'nodejs'
const BATCH = 20

// POST /api/admin/storage/reindex — extracts text for up to BATCH files that
// were uploaded before search-inside-files existed (contentText null). The
// admin UI calls it repeatedly until `remaining` is 0. Files that can't be
// indexed get '' so they aren't retried forever.
export async function POST() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const pending = await prisma.tutorFile.findMany({ where: { contentText: null }, select: { id: true, key: true, name: true, mimeType: true }, take: BATCH, orderBy: { createdAt: 'asc' } })
    for (const f of pending) {
      let text = ''
      if (isIndexable(f.name, f.mimeType)) {
        try {
          const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: f.key }))
          const bytes = await obj.Body?.transformToByteArray()
          if (bytes) text = await extractText(Buffer.from(bytes), f.name, f.mimeType)
        } catch (e) {
          console.error('[reindex] fetch failed', f.id, e)
        }
      }
      await prisma.tutorFile.update({ where: { id: f.id }, data: { contentText: text } })
    }
    const remaining = await prisma.tutorFile.count({ where: { contentText: null } })
    return NextResponse.json({ processed: pending.length, remaining })
  } catch (e) {
    console.error('[POST /api/admin/storage/reindex]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
