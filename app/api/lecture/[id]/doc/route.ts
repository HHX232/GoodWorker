import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/lecture/[id]/doc?since=N — the owner's cheap poll while an edit
// link is out: {docVersion} and, only when newer than N, the doc itself.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const since = Number(req.nextUrl.searchParams.get('since'))
    const row = await prisma.lectureNote.findUnique({ where: { id }, select: { docVersion: true } })
    const version = row?.docVersion ?? 0
    if (Number.isInteger(since) && since >= version) return NextResponse.json({ docVersion: version })
    const full = await prisma.lectureNote.findUnique({ where: { id }, select: { docJson: true, docVersion: true } })
    return NextResponse.json({ docVersion: full?.docVersion ?? version, docJson: full?.docJson ?? null })
  } catch (e) {
    console.error('[GET /api/lecture/[id]/doc]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
