import {PutObjectCommand} from '@aws-sdk/client-s3'
import {randomUUID} from 'crypto'
import {publicUrlForKey, s3, S3_BUCKET} from './s3Client'

function extOf(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// Server-side counterpart to app/api/upload/route.ts — for routes that
// already parse their own multipart FormData (e.g. comments, which mix
// files with other fields) and need the resulting files as real S3 URLs
// instead of embedding them as base64 in a DB column.
export async function uploadFilesToS3(form: FormData, field: string, folder: string, userId: string): Promise<string[]> {
  const entries = form.getAll(field)
  const urls: string[] = []
  for (const entry of entries) {
    if (!(entry instanceof File) || entry.size === 0) continue
    const ext = extOf(entry.name) || 'bin'
    const key = `${folder}/${userId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await entry.arrayBuffer())
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: entry.type || 'application/octet-stream',
      ACL: 'public-read'
    }))
    urls.push(publicUrlForKey(key))
  }
  return urls
}
