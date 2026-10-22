import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { canReadBook, MAX_BOOKMARK_LABEL, toBookmark } from '@/shared/lib/tutorFiles/books'

interface Params {
  params: Promise<{ id: string; bookmarkId: string }>
}

// A bookmark is the viewer's own: another user's id (or another book's) is a 404.
async function ownBookmark(params: Params['params']) {
  const user = await getFilesSessionUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id, bookmarkId } = await params
  if (!(await canReadBook(user, id))) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const row = await prisma.tutorBookmark.findFirst({ where: { id: bookmarkId, fileId: id, ownerId: user.id } })
  if (!row) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { row }
}

// PATCH /api/tutor-files/books/[id]/bookmarks/[bookmarkId] {label} — rename (empty clears). → { bookmark }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const own = await ownBookmark(params)
    if (own.response) return own.response
    const body = await req.json().catch(() => ({}))
    if (typeof body?.label !== 'string') return NextResponse.json({ error: 'label required' }, { status: 400 })
    const row = await prisma.tutorBookmark.update({ where: { id: own.row.id }, data: { label: body.label.trim().slice(0, MAX_BOOKMARK_LABEL) || null } })
    return NextResponse.json({ bookmark: toBookmark(row) })
  } catch (e) {
    console.error('[PATCH books/[id]/bookmarks/[bookmarkId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/tutor-files/books/[id]/bookmarks/[bookmarkId]. → { ok: true }
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const own = await ownBookmark(params)
    if (own.response) return own.response
    await prisma.tutorBookmark.delete({ where: { id: own.row.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE books/[id]/bookmarks/[bookmarkId]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
