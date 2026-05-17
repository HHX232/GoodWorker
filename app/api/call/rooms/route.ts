import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

async function checkAccess(
  room: { ownerId: string; accessType: string; allowedEmails: string[] },
  session: { user: { id: string; email?: string | null; role?: string } }
): Promise<boolean> {
  if (room.ownerId === session.user.id) return true
  if (room.accessType === 'ALL') return true
  if (room.accessType === 'NOBODY') return false
  if (room.accessType === 'SELECTED') {
    return room.allowedEmails.includes(session.user.email ?? '')
  }
  if (room.accessType === 'MY_STUDENTS') {
    // student must be linked to the room owner (teacher)
    const link = await prisma.teacherStudent.findFirst({
      where: { teacherId: room.ownerId, studentId: session.user.id },
    })
    return !!link
  }
  return false
}

// GET /api/call/rooms?name=xxx — check room status by name
// GET /api/call/rooms?id=xxx  — get room details by id (existing behaviour)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const name = searchParams.get('name')
    if (name) {
      // find the most recent room with this name (active first, then ended)
      const room = await prisma.videoCallRoom.findUnique({ where: { name } })
      if (!room) return NextResponse.json({ status: 'not_found' })

      if (room.endedAt) return NextResponse.json({ status: 'ended' })

      const hasAccess = await checkAccess(room, session)
      return NextResponse.json({ status: 'active', id: room.id, hasAccess })
    }

    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'name or id required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({ where: { id } })
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ id: room.id, name: room.name, ownerIdentity: room.ownerIdentity, topic: room.topic ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// POST /api/call/rooms — create a new room (always creates, caller must have checked status first)
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

    // If an active room with this name exists, check access and return it
    const existing = await prisma.videoCallRoom.findUnique({ where: { name } })
    if (existing && !existing.endedAt) {
      const hasAccess = await checkAccess(existing, session)
      if (!hasAccess) return NextResponse.json({ error: 'no_access' }, { status: 403 })
      return NextResponse.json({ id: existing.id, ownerIdentity: existing.ownerIdentity, isNew: false })
    }

    // Ended room exists with this name — generate a unique internal name
    const internalName = existing?.endedAt ? `${name}-${Date.now()}` : name

    const room = await prisma.videoCallRoom.create({
      data: {
        name: internalName,
        ownerIdentity: identity,
        ownerId: session.user.id,
        ownerRole: role,
        topic: topic ?? name,
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
