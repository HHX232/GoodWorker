import { NextResponse } from 'next/server'

const MAX_PHOTO_SIZE = 15 * 1024 * 1024 // DeepSeek caps at 32 MiB, base64 inflates ~33%
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** The `photo` field of a vision request as base64, or an error response. */
export async function photoFromForm(form: FormData | null): Promise<{ mimeType: string; base64: string } | NextResponse> {
  const photo = form?.get('photo')
  if (!(photo instanceof Blob)) return NextResponse.json({ error: 'photo required' }, { status: 400 })
  if (!ALLOWED_MIMES.has(photo.type)) return NextResponse.json({ error: 'UNSUPPORTED_PHOTO' }, { status: 400 })
  if (photo.size === 0 || photo.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 400 })
  return { mimeType: photo.type, base64: Buffer.from(await photo.arrayBuffer()).toString('base64') }
}
