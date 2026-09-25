import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { findFileVisibleToStudent, getFilesSessionUser } from '@/shared/lib/tutorFiles/access'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/tutor-files/files/[id]/open — the student opened (previewed or
// downloaded) a file. Records only the first time; the tutor sees it on hover
// over the student's avatar. A tutor opening their own file is a no-op.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role === 'TEACHER') return NextResponse.json({ ok: true })

    const { id } = await params
    if (!(await findFileVisibleToStudent(id, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await prisma.tutorFileOpen.createMany({ data: [{ fileId: id, studentId: user.id }], skipDuplicates: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[POST /api/tutor-files/files/[id]/open]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
