import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'
import { DriveError, driveErrorResponse, getStudentDriveLimits, getStudentUsedBytes, isStudentVipActive, putStudentFile } from '@/shared/lib/studentDrive/drive'

export const runtime = 'nodejs'

// POST /api/student-files/files — FormData {file, folderId?}. The student's
// own upload, paid from their own quota (never a tutor's).
export async function POST(req: NextRequest) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId
    if (!(await isStudentVipActive(studentId))) return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })

    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    const folderId = (formData?.get('folderId') as string | null) || null
    if (folderId && !(await prisma.studentFolder.findFirst({ where: { id: folderId, studentId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Cheap size checks before buffering the whole body.
    const { maxFileBytes, quotaBytes } = await getStudentDriveLimits()
    if (file.size > maxFileBytes) return NextResponse.json({ error: 'FILE_TOO_LARGE', maxFileBytes }, { status: 413 })
    if ((await getStudentUsedBytes(studentId)) + file.size > quotaBytes) return NextResponse.json({ error: 'QUOTA_EXCEEDED', quotaBytes }, { status: 413 })

    const created = await putStudentFile({
      studentId,
      folderId,
      name: file.name.slice(0, 200),
      mimeType: file.type || 'application/octet-stream',
      bytes: Buffer.from(await file.arrayBuffer()),
    })
    return NextResponse.json({ file: created, usedBytes: await getStudentUsedBytes(studentId), quotaBytes }, { status: 201 })
  } catch (e) {
    if (e instanceof DriveError) return driveErrorResponse(e)
    console.error('[POST /api/student-files/files]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
