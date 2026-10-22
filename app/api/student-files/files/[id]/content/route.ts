import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { fileContentResponse } from '@/shared/lib/tutorFiles/content'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/student-files/files/[id]/content — bytes for the in-app viewer,
// same octet-stream + attachment + CSP sandbox response as the tutor library.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    const { id } = await params
    const file = await prisma.studentFile.findFirst({ where: { id, studentId } })
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return fileContentResponse(file)
  } catch (e) {
    console.error('[GET /api/student-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
