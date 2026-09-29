import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'
import { isStudentVipActive, resolveOwnParent } from '@/shared/lib/studentDrive/drive'

// POST /api/student-files/folders — {name, parentId?}
export async function POST(req: NextRequest) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    if (!(await isStudentVipActive(studentId))) return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const parentId = typeof body?.parentId === 'string' && body.parentId ? body.parentId : null

    const parent = await resolveOwnParent(studentId, parentId)
    if (parent === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (parent === 'TOO_DEEP') return NextResponse.json({ error: 'MAX_DEPTH' }, { status: 400 })

    const folder = await prisma.studentFolder.create({ data: { studentId, parentId, name, ancestorIds: parent.ancestorIds } })
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt } }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/student-files/folders]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
