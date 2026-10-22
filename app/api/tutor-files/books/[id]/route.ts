import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { grantStudentSelect } from '@/shared/lib/tutorFiles/readModel'
import { canReadBook, coverProblem, deleteBookCover, deleteS3Objects, MAX_BOOK_TITLE, parseCoverKind, parseSpineColor, toBooksFor, uploadBookCover } from '@/shared/lib/tutorFiles/books'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/tutor-files/books/[id] — owner only. multipart (title?, spineColor?,
// cover? + coverKind? (default photo), resetCover?) or JSON (title?, spineColor?,
// resetCover?). `resetCover` drops the image → typographic cover; the client's
// "reset to page 1" instead uploads a rendered page 1 as `cover` with coverKind=page1.
// → { book }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const file = await canReadBook(user, id)
    if (!file || user.role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const isMultipart = req.headers.get('content-type')?.includes('multipart/form-data')
    const body: Record<string, unknown> | null = isMultipart
      ? await req.formData().then(fd => Object.fromEntries(fd.entries())).catch(() => null)
      : await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    let newCoverKey: string | null = null // put by THIS request — removed again if the row update fails
    const data: { bookTitle?: string; spineColor?: string; coverUrl?: string | null; coverKind?: string | null } = {}
    if (typeof body.title === 'string') {
      const title = body.title.trim().slice(0, MAX_BOOK_TITLE)
      if (!title) return NextResponse.json({ error: 'title is empty' }, { status: 400 })
      data.bookTitle = title
    }
    if (body.spineColor !== undefined) {
      const color = parseSpineColor(body.spineColor)
      if (!color) return NextResponse.json({ error: 'spineColor must be #RRGGBB' }, { status: 400 })
      data.spineColor = color
    }

    const cover = body.cover instanceof File && body.cover.size > 0 ? body.cover : null
    if (cover) {
      const problem = coverProblem(cover)
      if (problem) return NextResponse.json({ error: problem }, { status: problem === 'COVER_TOO_LARGE' ? 413 : 400 })
      const kind = body.coverKind === undefined ? 'photo' : parseCoverKind(body.coverKind)
      if (!kind) return NextResponse.json({ error: 'coverKind must be found, page1 or photo' }, { status: 400 })
      try {
        const uploaded = await uploadBookCover(user.id, cover)
        newCoverKey = uploaded.key
        data.coverUrl = uploaded.url
      } catch (e) {
        console.error('[PATCH /api/tutor-files/books/[id]] cover upload failed', e)
        return NextResponse.json({ error: 'Upload failed, try again' }, { status: 502 })
      }
      data.coverKind = kind
    } else if (body.resetCover === true || body.resetCover === 'true' || body.resetCover === '1') {
      data.coverUrl = null
      data.coverKind = null
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    let updated
    try {
      updated = await prisma.tutorFile.update({ where: { id }, data, include: { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } } })
    } catch (e) {
      if (newCoverKey) await deleteS3Objects([newCoverKey])
      throw e
    }
    if (data.coverUrl !== undefined) await deleteBookCover(file.coverUrl) // the replaced / dropped image
    const [book] = await toBooksFor(user, [updated])
    return NextResponse.json({ book })
  } catch (e) {
    console.error('[PATCH /api/tutor-files/books/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
