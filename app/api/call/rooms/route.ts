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

    const existing = await prisma.videoCallRoom.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ ownerIdentity: existing.ownerIdentity, isNew: false })

    const room = await prisma.videoCallRoom.create({
      data: { name, ownerIdentity: identity, ownerId: session.user.id, ownerRole: role },
    })
    return NextResponse.json({ ownerIdentity: room.ownerIdentity, isNew: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const room = await prisma.videoCallRoom.findUnique({ where: { name } })
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ownerIdentity: room.ownerIdentity })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
