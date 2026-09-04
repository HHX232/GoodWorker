import {S3Client} from '@aws-sdk/client-s3'

// Selectel/srvstorage.kz — S3-compatible, needs forcePathStyle since it
// doesn't support the virtual-hosted-style bucket.s3.host addressing AWS
// defaults to.
export const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  }
})

export const S3_BUCKET = process.env.S3_BUCKET!

export function publicUrlForKey(key: string): string {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${S3_BUCKET}`
  return `${base.replace(/\/$/, '')}/${key}`
}
