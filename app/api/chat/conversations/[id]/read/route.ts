import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getChatSessionUser, getOwnedConversation, otherRole } from '@/shared/lib/chat/access'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH /api/chat/conversations/[id]/read — marks every message from the other
// side of this dialog as read (R02.1). Never touches the current user's own
// outgoing messages.
export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const conversation = await getOwnedConversation(id, user)
    if (conversation === null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (conversation === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await prisma.chatMessage.updateMany({
      where: { conversationId: id, senderRole: otherRole(user.role), isRead: false },
      data: { isRead: true },
    })

    return NextResponse.json({ ok: true, updatedCount: result.count })
  } catch (e) {
    console.error('[PATCH /api/chat/conversations/[id]/read]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
