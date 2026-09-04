import {PutObjectCommand} from '@aws-sdk/client-s3'
import {randomUUID} from 'crypto'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'
import {publicUrlForKey, s3, S3_BUCKET} from '@/shared/s3/s3Client'

export const runtime = 'nodejs'

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf'
}

// Everything the app lets a user attach (avatars, cover photos, post/roadmap
// media, identity documents, feedback screenshots, experience proof) goes
// through here instead of being embedded as base64 directly in a DB column —
// that pattern was putting multi-megabyte rows in Postgres for a single
// image and bloating every query/response that touched them.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const formData = await req.formData()
  const file = formData.get('file')
  const folder = (formData.get('folder') as string | null)?.replace(/[^a-z0-9_-]/gi, '') || 'misc'

  if (!(file instanceof File)) {
    return NextResponse.json({error: 'file is required'}, {status: 400})
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({error: 'File too large (max 25MB)'}, {status: 413})
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({error: `Unsupported file type: ${file.type}`}, {status: 415})
  }

  const key = `${folder}/${session.user.id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ACL: 'public-read'
  }))

  return NextResponse.json({url: publicUrlForKey(key)})
}
