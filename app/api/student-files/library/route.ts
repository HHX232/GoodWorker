import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getDriveStudentId } from '@/shared/lib/studentDrive/session'
import { getStudentDriveLimits, getStudentUsedBytes, isStudentVipActive } from '@/shared/lib/studentDrive/drive'

// GET /api/student-files/library?folderId= — one level of the student's own
// drive: subfolders, files, breadcrumbs and the quota line. Reading stays
// open after VIP expires (their files are still theirs); writing needs VIP.
export async function GET(req: NextRequest) {
  try {
    const studentId = await getDriveStudentId()
    if (studentId instanceof NextResponse) return studentId

    const folderId = req.nextUrl.searchParams.get('folderId') || null
    const folder = folderId ? await prisma.studentFolder.findFirst({ where: { id: folderId, studentId } }) : null
    if (folderId && !folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [folders, files, crumbs, usedBytes, limits, isVip] = await Promise.all([
      prisma.studentFolder.findMany({ where: { studentId, parentId: folderId }, orderBy: { name: 'asc' } }),
      prisma.studentFile.findMany({ where: { studentId, folderId }, orderBy: { createdAt: 'desc' } }),
      folder?.ancestorIds.length ? prisma.studentFolder.findMany({ where: { id: { in: folder.ancestorIds }, studentId }, select: { id: true, name: true } }) : [],
      getStudentUsedBytes(studentId),
      getStudentDriveLimits(),
      isStudentVipActive(studentId),
    ])
    const byId = new Map(crumbs.map(c => [c.id, c]))
    const breadcrumbs = [
      ...(folder?.ancestorIds ?? []).map(id => byId.get(id)).filter((c): c is { id: string; name: string } => !!c),
      ...(folder ? [{ id: folder.id, name: folder.name }] : []),
    ]

    return NextResponse.json({
      folder: folder ? { id: folder.id, name: folder.name, parentId: folder.parentId } : null,
      breadcrumbs,
      folders: folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt })),
      files: files.map(f => ({
        id: f.id, name: f.name, sizeBytes: f.sizeBytes, mimeType: f.mimeType, url: f.url,
        lectureNoteId: f.lectureNoteId, createdAt: f.createdAt, updatedAt: f.updatedAt,
      })),
      usedBytes,
      quotaBytes: limits.quotaBytes,
      maxFileBytes: limits.maxFileBytes,
      isVip,
    })
  } catch (e) {
    console.error('[GET /api/student-files/library]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
