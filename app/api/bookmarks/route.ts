import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sourceType, sourceId, text,contextText, xpath, offset, length } = await req.json()

  const bookmark = await prisma.bookmark.create({
    data: {
      authorId: session.user.id,
      authorRole: session.user.role,
      sourceType,
      sourceId,
      text,
      xpath,
      contextText, 
      offset,
      length,
    }
  })

  return NextResponse.json(bookmark)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sourceType = searchParams.get('sourceType')
  const sourceId = searchParams.get('sourceId')

  const bookmarks = await prisma.bookmark.findMany({
    where: { authorId: session.user.id, authorRole: session.user.role, sourceType: sourceType!, sourceId: sourceId! },
    orderBy: { createdAt: 'asc' }
  })

  return NextResponse.json(bookmarks)
}