import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, requireOwnedFile } from '@/shared/lib/tutorFiles/access'
import { isAllowedCover } from '@/shared/lib/tutorFiles/covers'
import { postEventCard } from '@/shared/lib/chat/access'

const STATUSES = ['ACCEPTED', 'REVISION'] as const
type Status = (typeof STATUSES)[number]
const MAX_PAGES = 200

// PUT /api/tutor-files/files/[id]/review {status, grade?, comment?, annotations?}
// — the tutor checks a student's submission (idea 1): verdict, grade, comment
// and pen-mark overlays (PNGs on our own S3, one per marked page). The student
// gets a FILE_REVIEWED card in chat when the verdict is new or changes.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const guard = await requireOwnedFile(id, user.id)
    if (guard.response) return guard.response
    const file = guard.file
    if (file.uploadedByRole !== 'STUDENT') return NextResponse.json({ error: 'Only student submissions can be reviewed' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const status: Status | undefined = STATUSES.includes(body?.status) ? body.status : undefined
    if (!status) return NextResponse.json({ error: 'status must be ACCEPTED or REVISION' }, { status: 400 })
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
    const grade = text(body?.grade, 20)
    const comment = text(body?.comment, 4000)
    const annotations = Array.isArray(body?.annotations)
      ? body.annotations
          .filter((a: unknown): a is { page: number; url: string } =>
            !!a && typeof a === 'object' && Number.isInteger((a as { page: unknown }).page) && typeof (a as { url: unknown }).url === 'string')
          .filter((a: { page: number; url: string }) => a.page >= 1 && a.page <= MAX_PAGES && isAllowedCover(a.url, process.env.NEXT_PUBLIC_S3_PUBLIC_URL))
          .map((a: { page: number; url: string }) => ({ page: a.page, url: a.url }))
      : undefined

    const previous = await prisma.tutorFileReview.findUnique({ where: { fileId: id }, select: { status: true } })
    const review = await prisma.tutorFileReview.upsert({
      where: { fileId: id },
      create: { fileId: id, status, grade, comment, annotations: annotations ?? [] },
      update: { status, grade, comment, ...(annotations ? { annotations } : {}) },
    })

    if (previous?.status !== status) {
      postEventCard({
        teacherId: user.id,
        studentId: file.uploadedById,
        eventType: 'FILE_REVIEWED',
        payload: { fileName: file.name, status, grade, folderId: file.folderId },
      }).catch(e => console.error('[PUT review] card failed', e))
    }
    return NextResponse.json({ review })
  } catch (e) {
    console.error('[PUT /api/tutor-files/files/[id]/review]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
