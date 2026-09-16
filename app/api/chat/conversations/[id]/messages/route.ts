import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import {
  MAX_ATTACHMENT_BYTES,
  getChatSessionUser,
  requireOwnedConversation,
} from '@/shared/lib/chat/access'

interface Params {
  params: Promise<{ id: string }>
}

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

// GET /api/chat/conversations/[id]/messages?before=<messageId>&limit=30 — message
// history, newest-first cursor pagination. Returns the page in ascending
// (oldest-first) order, ready to render top-to-bottom, plus a `nextCursor` to
// fetch the page before it.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const guard = await requireOwnedConversation(id, user)
    if (guard.response) return guard.response

    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT
    const before = req.nextUrl.searchParams.get('before')

    let cursorCreatedAt: Date | null = null
    if (before) {
      const cursorMessage = await prisma.chatMessage.findUnique({ where: { id: before }, select: { createdAt: true } })
      cursorCreatedAt = cursorMessage?.createdAt ?? null
    }

    const rows = await prisma.chatMessage.findMany({
      where: {
        conversationId: id,
        ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })

    const hasMore = rows.length > limit
    const page = rows.slice(0, limit).reverse()

    return NextResponse.json({
      messages: page,
      hasMore,
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    })
  } catch (e) {
    console.error('[GET /api/chat/conversations/[id]/messages]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/chat/conversations/[id]/messages {text?, attachmentUrl?, attachmentType?,
// attachmentName?, attachmentSize?} — sends a message. Requires at least one of
// text/attachment (R09.1); attachmentSize is re-checked against the 10 MB cap
// server-side (R16) even though the client already enforces it.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getChatSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const guard = await requireOwnedConversation(id, user)
    if (guard.response) return guard.response

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const attachmentUrl = typeof body?.attachmentUrl === 'string' ? body.attachmentUrl : null
    const attachmentType = typeof body?.attachmentType === 'string' ? body.attachmentType : null
    const attachmentName = typeof body?.attachmentName === 'string' ? body.attachmentName : null
    const attachmentSize = typeof body?.attachmentSize === 'number' ? body.attachmentSize : null

    if (!text && !attachmentUrl) {
      return NextResponse.json({ error: 'Message must have text or an attachment' }, { status: 400 })
    }
    if (attachmentSize !== null && attachmentSize > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: 'Attachment exceeds 10MB limit' }, { status: 400 })
    }

    const [message] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: id,
          senderRole: user.role,
          text: text || null,
          attachmentUrl,
          attachmentType,
          attachmentName,
          attachmentSize,
        },
      }),
      prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      }),
    ])

    return NextResponse.json({ message })
  } catch (e) {
    console.error('[POST /api/chat/conversations/[id]/messages]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
