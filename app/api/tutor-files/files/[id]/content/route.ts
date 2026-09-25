import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { fileContentResponse } from '@/shared/lib/tutorFiles/content'
import { findFileVisibleToStudent, getFilesSessionUser } from '@/shared/lib/tutorFiles/access'

export const runtime = 'nodejs'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/tutor-files/files/[id]/content — the raw bytes for the in-app
// viewer (txt/csv/docx/xlsx are parsed client-side). Goes through the API,
// not the public URL, because the bucket's website domain sends no CORS
// headers for fetch(), and so access is checked the same way as everywhere
// else (owner, or a student who can see the file).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const file = user.role === 'TEACHER'
      ? await prisma.tutorFile.findFirst({ where: { id, teacherId: user.id } })
      : await findFileVisibleToStudent(id, user.id)
    if (!file) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return fileContentResponse(file)
  } catch (e) {
    console.error('[GET /api/tutor-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
