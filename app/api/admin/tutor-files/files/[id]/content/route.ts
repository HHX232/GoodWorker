import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { fileContentResponse } from '@/shared/lib/tutorFiles/content'

export const runtime = 'nodejs'

// GET /api/admin/tutor-files/files/[id]/content — viewer bytes for the admin's
// silent read-only view (no TutorFileOpen row, unlike the student path).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const { id } = await params
    const file = await prisma.tutorFile.findUnique({ where: { id } })
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return fileContentResponse(file)
  } catch (e) {
    console.error('[GET /api/admin/tutor-files/files/[id]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
