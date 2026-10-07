import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getFilesSessionUser } from '@/shared/lib/tutorFiles/access'
import { canReadBook } from '@/shared/lib/tutorFiles/books'

interface Params {
  params: Promise<{ id: string }>
}

// PUT / DELETE /api/tutor-files/books/[id]/save — put the book on / take it off
// the viewer's "Мои книги" shelf (a bookmark, not a copy: no quota). Idempotent.
// → { saved: boolean }
async function setSaved(saved: boolean, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!(await canReadBook(user, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const key = { fileId: id, ownerId: user.id }
    if (saved) await prisma.tutorBookSave.upsert({ where: { fileId_ownerId: key }, create: { ...key, ownerRole: user.role }, update: {} })
    else await prisma.tutorBookSave.deleteMany({ where: key })
    return NextResponse.json({ saved })
  } catch (e) {
    console.error('[books/[id]/save]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const PUT = (_req: NextRequest, ctx: Params) => setSaved(true, ctx)
export const DELETE = (_req: NextRequest, ctx: Params) => setSaved(false, ctx)
