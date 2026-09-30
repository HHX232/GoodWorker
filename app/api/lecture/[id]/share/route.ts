import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { newShareToken, type ShareMode } from '@/shared/lib/lecture/share'

interface Params {
  params: Promise<{ id: string }>
}

const field = (mode: ShareMode) => (mode === 'edit' ? 'shareEditToken' : 'shareViewToken')
const modeOf = (v: unknown): ShareMode | null => (v === 'view' || v === 'edit' ? v : null)

// POST /api/lecture/[id]/share {mode: view|edit} — turns that public link on
// (the existing token is kept, so a link already sent keeps working) → {token}.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const mode = modeOf((await req.json().catch(() => ({}))).mode)
    if (!mode) return NextResponse.json({ error: 'mode must be view|edit' }, { status: 400 })
    const current = guard.lecture[field(mode)]
    if (current) return NextResponse.json({ token: current })
    const token = newShareToken()
    await prisma.lectureNote.update({ where: { id }, data: { [field(mode)]: token } })
    return NextResponse.json({ token })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/share]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/lecture/[id]/share?mode=view|edit — revokes that link for good
// (turning it on again makes a new one).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const mode = modeOf(req.nextUrl.searchParams.get('mode'))
    if (!mode) return NextResponse.json({ error: 'mode must be view|edit' }, { status: 400 })
    await prisma.lectureNote.update({ where: { id }, data: { [field(mode)]: null } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/lecture/[id]/share]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
