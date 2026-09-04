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

// This provider (Selectel/srvstorage.kz) doesn't serve public reads off the
// regular S3 API endpoint at all — "Создание ссылок через ObjectACL не
// поддерживается" is literally what their own console says. Public access
// only works through the bucket's separate "Веб-сайт" (static website)
// domain (an assigned *.srvstatic.kz host, or a custom domain mapped to
// it), which is what NEXT_PUBLIC_S3_PUBLIC_URL must point at. Falling back
// to the API endpoint here would silently produce URLs that 403 for every
// visitor, so a missing env var is a loud failure instead.
export function publicUrlForKey(key: string): string {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL
  if (!base) {
    throw new Error('NEXT_PUBLIC_S3_PUBLIC_URL is not set — see src/shared/s3/s3Client.ts')
  }
  return `${base.replace(/\/$/, '')}/${key}`
}
