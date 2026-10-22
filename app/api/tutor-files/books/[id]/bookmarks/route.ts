import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { canReadBook, isPageInRange, MAX_BOOKMARK_LABEL, toBookmark } from '@/shared/lib/tutorFiles/books'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/tutor-files/books/[id]/bookmarks — the viewer's own page bookmarks, by page.
// → { bookmarks: BookBookmark[] }
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!(await canReadBook(user, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const rows = await prisma.tutorBookmark.findMany({ where: { fileId: id, ownerId: user.id }, orderBy: { page: 'asc' } })
    return NextResponse.json({ bookmarks: rows.map(toBookmark) })
  } catch (e) {
    console.error('[GET /api/tutor-files/books/[id]/bookmarks]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/tutor-files/books/[id]/bookmarks {page, label?} — bookmark a page
// (upsert: one per page; a given `label` replaces the old one). → { bookmark }
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
    const label = typeof body?.label === 'string' ? body.label.trim().slice(0, MAX_BOOKMARK_LABEL) || null : undefined

    const where = { fileId_ownerId_page: { fileId: id, ownerId: user.id, page } }
    const row = await prisma.tutorBookmark.upsert({
      where,
      create: { fileId: id, ownerId: user.id, ownerRole: user.role, page, label: label ?? null },
      update: label === undefined ? {} : { label },
    })
    return NextResponse.json({ bookmark: toBookmark(row) })
  } catch (e) {
    console.error('[POST /api/tutor-files/books/[id]/bookmarks]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
