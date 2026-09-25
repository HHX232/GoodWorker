import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'

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
        prisma.tutorFolder.findMany({ where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' } }),
        prisma.tutorFile.findMany({ where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' } }),
      ])
      return NextResponse.json({ folders, files })
    }

    const { folders, files } = await loadStudentVisibility(user.id)
    const lowerQ = q.toLowerCase()
    return NextResponse.json({
      folders: folders.filter(f => f.name.toLowerCase().includes(lowerQ)),
      files: files.filter(f => f.name.toLowerCase().includes(lowerQ)),
    })
  } catch (e) {
    console.error('[GET /api/tutor-files/search]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
