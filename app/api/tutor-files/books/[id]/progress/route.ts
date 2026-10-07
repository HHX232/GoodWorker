import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { bookPct, canReadBook, isPageInRange } from '@/shared/lib/tutorFiles/books'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/tutor-files/books/[id]/progress {page} — where the viewer is now.
// Upserts their TutorBookProgress; a student also gets a TutorBookRead row for
// the page (lastReadAt refreshed — what the tutor sees as reader marks) and a
// first-open record (the avatar hover). → { progress: { lastPage, pct, updatedAt } }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const book = await canReadBook(user, id)
    if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const page = body?.page
    if (!isPageInRange(page, book.pageCount)) return NextResponse.json({ error: 'page out of range' }, { status: 400 })

    const now = new Date()
    const progress = await prisma.tutorBookProgress.upsert({
      where: { fileId_ownerId: { fileId: id, ownerId: user.id } },
      create: { fileId: id, ownerId: user.id, ownerRole: user.role, lastPage: page },
      update: { lastPage: page },
    })
    if (user.role === 'STUDENT') {
      await prisma.tutorBookRead.upsert({
        where: { fileId_studentId_page: { fileId: id, studentId: user.id, page } },
        create: { fileId: id, studentId: user.id, page, firstReadAt: now, lastReadAt: now },
        update: { lastReadAt: now },
      })
      await prisma.tutorFileOpen.createMany({ data: [{ fileId: id, studentId: user.id }], skipDuplicates: true })
    }
    const pct = bookPct(progress.lastPage, book.pageCount)
    return NextResponse.json({ progress: { lastPage: progress.lastPage, pct, updatedAt: progress.updatedAt.toISOString() } })
  } catch (e) {
    console.error('[POST /api/tutor-files/books/[id]/progress]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
