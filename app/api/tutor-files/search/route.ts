import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'
import { grantStudentSelect, studentItemCounter, toFile, toFolder } from '@/shared/lib/tutorFiles/readModel'

// GET /api/tutor-files/search?q=... — teacher searches their whole library by
// name; student searches only their granted subset, via the same
// canStudentSee() rule from ticket 01 (loadStudentVisibility applies it, the
// library read model uses the same loader).
export async function GET(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) return NextResponse.json({ folders: [], files: [] })

    if (user.role === 'TEACHER') {
      const [folders, files] = await Promise.all([
        prisma.tutorFolder.findMany({
          where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } },
          include: { _count: { select: { children: true, files: true } }, grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { name: 'asc' },
        }),
        prisma.tutorFile.findMany({
          where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } },
          include: { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { name: 'asc' },
        }),
      ])
      return NextResponse.json({
        folders: folders.map(f => toFolder(f, f._count.children + f._count.files, f.grants)),
        files: files.map(f => toFile(f, f.grants)),
      })
    }

    const { folders, files } = await loadStudentVisibility(user.id)
    const lowerQ = q.toLowerCase()
    const countOf = studentItemCounter(folders, files)
    return NextResponse.json({
      folders: folders.filter(f => f.name.toLowerCase().includes(lowerQ)).map(f => toFolder(f, countOf(f.id))),
      files: files.filter(f => f.name.toLowerCase().includes(lowerQ)).map(f => toFile(f)),
    })
  } catch (e) {
    console.error('[GET /api/tutor-files/search]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
