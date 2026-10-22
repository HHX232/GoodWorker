import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { canReadBook } from '@/shared/lib/tutorFiles/books'
import { MAX_HIGHLIGHTS_PER_BOOK, parseHighlightInput, parseRects, readJsonBody, toHighlight } from '@/shared/lib/tutorFiles/bookHighlights'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/tutor-files/books/[id]/highlights — the viewer's own highlights, by page then time.
// → { highlights: BookHighlight[] }
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!(await canReadBook(user, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const rows = await prisma.tutorBookHighlight.findMany({
      where: { fileId: id, ownerId: user.id },
      orderBy: [{ page: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ highlights: rows.map(toHighlight) })
  } catch (e) {
    console.error('[GET /api/tutor-files/books/[id]/highlights]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/tutor-files/books/[id]/highlights {page, text, rects, color?, note?} → { highlight }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const book = await canReadBook(user, id)
    if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const read = await readJsonBody(req)
    if (read.tooLarge) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    const parsed = parseHighlightInput(read.body, book.pageCount)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { page, text, rects, color, note } = parsed.data

    // Idempotent: the same quote with the same geometry on the same page is returned, not duplicated.
    const sameSpot = await prisma.tutorBookHighlight.findMany({ where: { fileId: id, ownerId: user.id, page, text } })
    const dup = sameSpot.find(r => JSON.stringify(parseRects(r.rects)) === JSON.stringify(rects))
    if (dup) return NextResponse.json({ highlight: toHighlight(dup) })

    if ((await prisma.tutorBookHighlight.count({ where: { fileId: id, ownerId: user.id } })) >= MAX_HIGHLIGHTS_PER_BOOK) {
      return NextResponse.json({ error: 'HIGHLIGHT_LIMIT' }, { status: 409 })
    }

    const row = await prisma.tutorBookHighlight.create({
      data: { fileId: id, ownerId: user.id, ownerRole: user.role, page, text, rects: rects as unknown as Prisma.InputJsonValue, color, note },
    })
    return NextResponse.json({ highlight: toHighlight(row) })
  } catch (e) {
    console.error('[POST /api/tutor-files/books/[id]/highlights]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
