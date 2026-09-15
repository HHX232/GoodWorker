import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildConversationSummary,
  getChatSessionUser,
  hasTeacherStudentLink,
} from '@/shared/lib/chat/access'

// GET /api/chat/conversations — list of the current user's dialogs (both TEACHER and
// STUDENT roles), newest activity first. Each entry carries the other side's
// profile, a preview of the last message, and how many of their messages are unread.
export async function GET() {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conversations = await prisma.conversation.findMany({
      where: user.role === 'TEACHER' ? { teacherId: user.id } : { studentId: user.id },
      orderBy: { lastMessageAt: 'desc' },
    })

    const summaries = await Promise.all(
      conversations.map(c => buildConversationSummary(c, user.role))
    )

    return NextResponse.json({ conversations: summaries })
  } catch (e) {
    console.error('[GET /api/chat/conversations]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/chat/conversations {otherId} — get-or-create the dialog between the
// current user and `otherId`. Only allowed when a TeacherStudent link already
// connects them (R18i.1) — chat never creates that relationship, only rides it.
export async function POST(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const otherId = typeof body?.otherId === 'string' ? body.otherId : null
    if (!otherId) return NextResponse.json({ error: 'otherId required' }, { status: 400 })

    const teacherId = user.role === 'TEACHER' ? user.id : otherId
    const studentId = user.role === 'TEACHER' ? otherId : user.id

    if (!(await hasTeacherStudentLink(teacherId, studentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conversation = await prisma.conversation.upsert({
      where: { teacherId_studentId: { teacherId, studentId } },
      create: { teacherId, studentId },
      update: {},
    })

    const summary = await buildConversationSummary(conversation, user.role)
    return NextResponse.json({ conversation: summary })
  } catch (e) {
    console.error('[POST /api/chat/conversations]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
