import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { putLecturePhoto } from '@/shared/lib/lecture/audio'
import { ownerFreeBytes } from '@/shared/lib/lecture/quota'
import { resolveShare } from '@/shared/lib/lecture/share'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ token: string }>
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

// POST /api/lecture/shared/[token]/photos — an edit link adds a photo / board
// or graph snapshot. Same as the owner's route; it lands in the owner's quota.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const share = await resolveShare((await params).token)
    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (share.mode !== 'edit') return NextResponse.json({ error: 'READ_ONLY' }, { status: 403 })
    const { lecture } = share
    const form = await req.formData().catch(() => null)
    const file = form?.get('photo')
    if (!(file instanceof Blob) || !ALLOWED.has(file.type) || file.size === 0) return NextResponse.json({ error: 'UNSUPPORTED_PHOTO' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 413 })
    const width = Math.max(1, Math.min(20000, Number(form?.get('width')) || 1))
    const height = Math.max(1, Math.min(20000, Number(form?.get('height')) || 1))
    const role = lecture.ownerRole === 'STUDENT' ? 'STUDENT' : 'TEACHER'
    if ((await ownerFreeBytes(lecture.ownerId, role)) < file.size) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 413 })

    const bytes = Buffer.from(await file.arrayBuffer())
    const key = await putLecturePhoto(lecture.ownerId, lecture.id, bytes, file.type)
    const photo = await prisma.lecturePhoto.create({ data: { lectureId: lecture.id, key, mimeType: file.type, sizeBytes: bytes.length, width, height } })
    return NextResponse.json({ photo: { id: photo.id, width, height } }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/lecture/shared/[token]/photos]', e)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 502 })
  }
}
