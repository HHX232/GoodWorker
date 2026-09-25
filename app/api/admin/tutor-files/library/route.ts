import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/shared/lib/tutorFiles/adminGuard'
import { buildTeacherLibrary } from '@/shared/lib/tutorFiles/teacherLibrary'

// GET /api/admin/tutor-files/library?teacherId=…&folderId=… — an admin's
// read-only view of any tutor's library. Silent by design: nothing is
// recorded (no first-open rows, no chat cards, no logs the tutor can see).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  const teacherId = req.nextUrl.searchParams.get('teacherId')
  if (!teacherId) return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
  try {
    const body = await buildTeacherLibrary(teacherId, req.nextUrl.searchParams.get('folderId') || null)
    if ('status' in body) return NextResponse.json({ error: body.error }, { status: body.status })
    // The admin never uploads/manages here.
    return NextResponse.json({ ...body, canUpload: false })
  } catch (e) {
    console.error('[GET /api/admin/tutor-files/library]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
