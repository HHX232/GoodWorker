import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { canReadBook } from '@/shared/lib/tutorFiles/books'
import { parseHighlightPatch, readJsonBody, toHighlight } from '@/shared/lib/tutorFiles/bookHighlights'

interface Params {
  params: Promise<{ id: string; highlightId: string }>
}

// A highlight is the viewer's own: another user's id (or another book's) is a 404.
async function ownHighlight(params: Params['params']) {
  const user = await getFilesSessionUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id, highlightId } = await params
  if (!(await canReadBook(user, id))) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const row = await prisma.tutorBookHighlight.findFirst({ where: { id: highlightId, fileId: id, ownerId: user.id } })
  if (!row) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { row }
}

// PATCH /api/tutor-files/books/[id]/highlights/[highlightId] {note?, color?} → { highlight }
// (empty/blank note clears the comment)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const own = await ownHighlight(params)
    if (own.response) return own.response
    const read = await readJsonBody(req)
    if (read.tooLarge) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    const parsed = parseHighlightPatch(read.body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const row = await prisma.tutorBookHighlight.update({ where: { id: own.row.id }, data: parsed.data })
    return NextResponse.json({ highlight: toHighlight(row) })
  } catch (e) {
    console.error('[PATCH books/[id]/highlights/[highlightId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/tutor-files/books/[id]/highlights/[highlightId]. → { ok: true }
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const own = await ownHighlight(params)
    if (own.response) return own.response
    await prisma.tutorBookHighlight.delete({ where: { id: own.row.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE books/[id]/highlights/[highlightId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
