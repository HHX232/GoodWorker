import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const roomName = body?.roomName
    if (!roomName?.trim()) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const name = roomName.trim()
    const identity = session.user.name ?? session.user.id
    const role = session.user.role as 'STUDENT' | 'TEACHER'
    const topic: string | undefined = body?.topic?.trim() || undefined
    const categoryId: string | undefined = body?.categoryId || undefined
    const accessType: string = body?.accessType ?? 'ALL'
    const allowedEmails: string[] = Array.isArray(body?.allowedEmails) ? body.allowedEmails : []

    const existing = await prisma.videoCallRoom.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ id: existing.id, ownerIdentity: existing.ownerIdentity, isNew: false })
    }

    const room = await prisma.videoCallRoom.create({
      data: {
        name,
        ownerIdentity: identity,
        ownerId: session.user.id,
        ownerRole: role,
        topic,
        categoryId,
        accessType: accessType as any,
        allowedEmails,
      },
    })
    return NextResponse.json({ id: room.id, ownerIdentity: room.ownerIdentity, isNew: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const room = await prisma.videoCallRoom.findUnique({ where: { id } })
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ id: room.id, name: room.name, ownerIdentity: room.ownerIdentity, topic: room.topic ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
