import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { putLecturePhoto } from '@/shared/lib/lecture/audio'
import { ownerFreeBytes } from '@/shared/lib/lecture/quota'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

// POST /api/lecture/[id]/photos — FormData {photo, width, height} → {photo}.
// The client already downscaled/cropped it; stored privately, counted in the owner's quota.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const { user } = guard
    const form = await req.formData().catch(() => null)
    const file = form?.get('photo')
    if (!(file instanceof Blob) || !ALLOWED.has(file.type) || file.size === 0) return NextResponse.json({ error: 'UNSUPPORTED_PHOTO' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 413 })
    const width = Math.max(1, Math.min(20000, Number(form?.get('width')) || 1))
    const height = Math.max(1, Math.min(20000, Number(form?.get('height')) || 1))
    if (!user.isAdmin && (await ownerFreeBytes(user.id, user.role)) < file.size) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 413 })

    const bytes = Buffer.from(await file.arrayBuffer())
    const key = await putLecturePhoto(user.id, id, bytes, file.type)
    const photo = await prisma.lecturePhoto.create({ data: { lectureId: id, key, mimeType: file.type, sizeBytes: bytes.length, width, height } })
    return NextResponse.json({ photo: { id: photo.id, width, height } }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/photos]', e)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 502 })
  }
}
