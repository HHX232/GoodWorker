import {PutObjectCommand} from '@aws-sdk/client-s3'
import {randomUUID} from 'crypto'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'
import {publicUrlForKey, s3, S3_BUCKET} from '@/shared/s3/s3Client'

export const runtime = 'nodejs'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB — matches InfoFileListEditor's own cap

// InfoFileListEditor advertises "any format" for generic attachments, so this
// is a denylist (block the executable/script kinds that would be genuinely
// dangerous to host publicly) rather than an allowlist — narrower uploaders
// (avatars, post media) already constrain `accept` on the <input> itself.
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'dll', 'jar', 'app', 'apk',
  'deb', 'rpm', 'ps1', 'vbs', 'vbe', 'wsf', 'wsh', 'js', 'jse', 'sh', 'bin'
])

function extOf(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// Everything the app lets a user attach (avatars, cover photos, post/roadmap
// media, generic file/audio attachments, identity documents, feedback
// screenshots, experience proof) goes through here instead of being
// embedded as base64 directly in a DB column, or as a blob: URL that only
// resolves in the uploader's own browser tab — both patterns were found in
// the wild here (one post's `content` column alone was 6.8MB from an
// embedded video; InfoAudioEditor/InfoFileListEditor were saving blob: URLs
// that go dead the moment the page reloads).
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
    return NextResponse.json({error: 'File too large (max 50MB)'}, {status: 413})
  }
  const ext = extOf(file.name) || 'bin'
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json({error: `Unsupported file type: .${ext}`}, {status: 415})
  }

  const key = `${folder}/${session.user.id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type || 'application/octet-stream',
    ACL: 'public-read'
  }))

  return NextResponse.json({url: publicUrlForKey(key)})
}
