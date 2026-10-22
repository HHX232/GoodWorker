import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/student-files/files/[id] — {name?, folderId?} rename / move.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const body = await req.json().catch(() => null)
    const data: { name?: string; folderId?: string | null } = {}
    if (typeof body?.name === 'string') {
      const name = body.name.trim().slice(0, 200)
      if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
      data.name = name
    }
    if (body && 'folderId' in body) {
      const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : null
      if (folderId && !(await prisma.studentFolder.findFirst({ where: { id: folderId, studentId }, select: { id: true } }))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      data.folderId = folderId
    }
    const { count } = await prisma.studentFile.updateMany({ where: { id, studentId }, data })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /api/student-files/files/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const { count } = await prisma.studentFile.deleteMany({ where: { id, studentId } })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/student-files/files/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
