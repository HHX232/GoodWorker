import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../../../auth'
import { loadLinkedSubtree } from '@/shared/lib/tutorFiles/folderLinks'

// POST /api/tutor-files/links/[token]/files/[fileId]/open — a student opened a
// file from a linked folder (preview or download); only the first time counts.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'STUDENT') return NextResponse.json({ ok: true })
  try {
    const { token, fileId } = await params
    const tree = await loadLinkedSubtree(token)
    if (!tree?.files.some(f => f.id === fileId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.tutorFileOpen.createMany({ data: [{ fileId, studentId: session.user.id }], skipDuplicates: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[POST /api/tutor-files/links/[token]/files/[fileId]/open]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
