import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/student-files/folders/[id] — {name}. Renaming/deleting own
// things stays open without VIP (only adding bytes needs it).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const { count } = await prisma.studentFolder.updateMany({ where: { id, studentId }, data: { name } })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /api/student-files/folders/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/student-files/folders/[id] — the folder, its subfolders and
// their files (FK cascade). S3 objects stay, as everywhere in this app.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const { count } = await prisma.studentFolder.deleteMany({ where: { id, studentId } })
    if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/student-files/folders/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
