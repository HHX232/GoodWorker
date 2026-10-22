import { NextResponse } from 'next/server'
import { getLectureUser } from '@/shared/lib/lecture/access'
import { subjectList } from '@/shared/lib/lecture/subjects'

// GET /api/lecture/subjects — the subjects of the caller's own lectures, for
// the "Предмет" filter in /files (student drive and tutor library alike).
export async function GET() {
  try {
    const user = await getLectureUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ subjects: await subjectList(user.id, user.role) })
  } catch (e) {
    console.error('[GET /api/lecture/subjects]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
