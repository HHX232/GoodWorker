import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getLectureUser, hasLectureAccess, vipRequired } from '@/shared/lib/lecture/access'
import { isSttConfigured } from '@/shared/lib/lecture/stt'

// GET /api/lecture — the caller's lectures, newest first.
export async function GET() {
  try {
    const user = await getLectureUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [lectures, access] = await Promise.all([
      prisma.lectureNote.findMany({
        where: { ownerId: user.id, ownerRole: user.role },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true, recordedMs: true, costKopecks: true, fileId: true, createdAt: true, updatedAt: true },
      }),
      hasLectureAccess(user),
    ])
    return NextResponse.json({ lectures, access, sttConfigured: isSttConfigured(), isAdmin: user.isAdmin })
  } catch (e) {
    console.error('[GET /api/lecture]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/lecture — {title?, keepAudio?} → a new lecture in RECORDING.
export async function POST(req: NextRequest) {
  try {
    const user = await getLectureUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await hasLectureAccess(user))) return vipRequired()
    const body = await req.json().catch(() => ({}))
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : ''
    const lecture = await prisma.lectureNote.create({
      data: { ownerId: user.id, ownerRole: user.role, title, keepAudio: body.keepAudio === true },
    })
    return NextResponse.json({ lecture }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/lecture]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
