import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { getChatSessionUser, otherRole } from '@/shared/lib/chat/access'

// GET /api/chat/unread-count — total unread messages across all of the current
// user's dialogs (R04.1 badge next to the header bell icon).
export async function GET() {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const count = await prisma.chatMessage.count({
      where: {
        isRead: false,
        senderRole: otherRole(user.role),
        conversation: user.role === 'TEACHER' ? { teacherId: user.id } : { studentId: user.id },
      },
    })

    return NextResponse.json({ count })
  } catch (e) {
    console.error('[GET /api/chat/unread-count]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
